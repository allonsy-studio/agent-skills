// ---------------------------------------------------------------------------
// Enrichment cache (TTL + LRU, optional disk persistence)
// ---------------------------------------------------------------------------

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CACHE_FILE_NAME = "enrichment-cache.json";
const CACHE_FORMAT_VERSION = 1;
const DEFAULT_TTL_SECONDS = 3600;
const DEFAULT_MAX_ENTRIES = 256;

let _cacheSingleton = null;
let _cacheCfgKey = "";

/**
 * Read cache settings from environment variables.
 *
 * Env vars (all optional):
 *  - GH_NOTIFICATION_CACHE_TTL      seconds (default 3600); 0 disables
 *  - GH_NOTIFICATION_CACHE_MAX      max entries (default 256, min 1)
 *  - GH_NOTIFICATION_CACHE_PERSIST  "0"/"false" disables disk persistence; default enabled
 *  - GH_NOTIFICATION_CACHE_DIR      override persist directory
 *  - XDG_CACHE_HOME                 fallback persist root
 *
 * @returns {{ ttl: number, maxEntries: number, persistPath: string | null }}
 */
export function readCacheSettings() {
	const ttlRaw = process.env.GH_NOTIFICATION_CACHE_TTL?.trim();
	const ttlParsed = ttlRaw !== undefined ? Number(ttlRaw) : NaN;
	const ttl = Number.isFinite(ttlParsed) ? ttlParsed : DEFAULT_TTL_SECONDS;

	const maxRaw = process.env.GH_NOTIFICATION_CACHE_MAX?.trim();
	const maxParsed = maxRaw !== undefined ? Number(maxRaw) : NaN;
	let maxEntries = Number.isFinite(maxParsed)
		? Math.floor(maxParsed)
		: DEFAULT_MAX_ENTRIES;
	if (maxEntries < 1) maxEntries = 1;

	const persistFlag = process.env.GH_NOTIFICATION_CACHE_PERSIST?.trim();
	const persistDisabled =
		persistFlag === "0" || persistFlag?.toLowerCase() === "false";

	let persistPath = null;
	if (!persistDisabled) {
		const dir = process.env.GH_NOTIFICATION_CACHE_DIR?.trim()
			? path.resolve(process.env.GH_NOTIFICATION_CACHE_DIR)
			: process.env.XDG_CACHE_HOME?.trim()
				? path.join(
						path.resolve(process.env.XDG_CACHE_HOME),
						"gh-notification-summary"
					)
				: path.join(os.homedir(), ".cache", "gh-notification-summary");
		persistPath = path.join(dir, CACHE_FILE_NAME);
	}

	return { ttl, maxEntries, persistPath };
}

/**
 * Reset the cache singleton. Used in tests and when settings change.
 */
export function resetCache() {
	_cacheSingleton = null;
	_cacheCfgKey = "";
}

/**
 * Get the shared cache singleton, or null if caching is disabled (ttl <= 0).
 * Recreates the singleton when settings change.
 *
 * @returns {Cache | null}
 */
export function getCache() {
	const { ttl, maxEntries, persistPath } = readCacheSettings();
	if (ttl <= 0) {
		_cacheSingleton = null;
		_cacheCfgKey = "";
		return null;
	}
	const key = `${ttl}:${maxEntries}:${persistPath ?? "mem"}`;
	if (!_cacheSingleton || _cacheCfgKey !== key) {
		_cacheSingleton = new Cache(ttl, maxEntries, persistPath);
		_cacheCfgKey = key;
	}
	return _cacheSingleton;
}

/**
 * TTL + LRU cache with optional JSON-file persistence.
 *
 * Stores `{ labels, comments }` tuples keyed by a notification-context key.
 * Values are deep-cloned on set and get so callers can mutate freely.
 */
export class Cache {
	/**
	 * @param {number} ttlSeconds - Time-to-live in seconds (fractional ok).
	 * @param {number} maxEntries - LRU capacity.
	 * @param {string} [persistPath] - JSON file path; when set, entries persist across processes.
	 */
	constructor(ttlSeconds, maxEntries, persistPath) {
		this._ttl = ttlSeconds;
		this._max = Math.max(1, Math.floor(maxEntries));
		this._persistPath = persistPath ? String(persistPath) : null;
		/** @type {Map<string, { expire: number, labels: object[], comments: object[] }>} */
		this._store = new Map();
		/** Pending coalesced flush timer; null when no write is queued. */
		this._flushTimer = null;
		/** Process-exit hook installed lazily, only when we persist. */
		this._exitHookInstalled = false;

		if (this._persistPath) {
			const dir = path.dirname(this._persistPath);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			this.loadFromDisk();
		}
	}

	/**
	 * @param {string} key
	 * @returns {{ labels: object[], comments: object[] } | null}
	 */
	get(key) {
		const row = this._store.get(key);
		if (!row) return null;

		if (row.expire <= Date.now() / 1000) {
			this._store.delete(key);
			this.#schedulePersist();
			return null;
		}

		// LRU bump: re-insert to move to most-recently-used end.
		this._store.delete(key);
		this._store.set(key, row);

		return {
			labels: structuredClone(row.labels),
			comments: structuredClone(row.comments),
		};
	}

	/**
	 * @param {string} key
	 * @param {object[]} labels
	 * @param {object[]} comments
	 */
	set(key, labels, comments) {
		const expire = Date.now() / 1000 + this._ttl;
		const row = {
			expire,
			labels: structuredClone(labels ?? []),
			comments: structuredClone(comments ?? []),
		};

		if (this._store.has(key)) this._store.delete(key);
		this._store.set(key, row);

		while (this._store.size > this._max) {
			const oldest = this._store.keys().next().value;
			this._store.delete(oldest);
		}

		this.#schedulePersist();
	}

	/**
	 * Coalesce disk writes: queue a flush on the next microtask-after-tick
	 * rather than writing per `set()`. A batch enrichment of N notifications
	 * triggers one write instead of N.
	 */
	#schedulePersist() {
		if (!this._persistPath) return;
		if (this._flushTimer) return;
		if (!this._exitHookInstalled) {
			this._exitHookInstalled = true;
			process.once("exit", () => {
				if (this._flushTimer) {
					clearTimeout(this._flushTimer);
					this._flushTimer = null;
					this.persistToDisk();
				}
			});
		}
		this._flushTimer = setTimeout(() => {
			this._flushTimer = null;
			try {
				this.persistToDisk();
			} catch {
				// Best-effort; persisting will retry on next set.
			}
		}, 0);
		// Don't keep the event loop alive solely for the flush.
		if (typeof this._flushTimer.unref === "function") {
			this._flushTimer.unref();
		}
	}

	/**
	 * Force any pending disk write to flush immediately. Useful in tests or
	 * when a caller knows the process is about to exit.
	 */
	flush() {
		if (this._flushTimer) {
			clearTimeout(this._flushTimer);
			this._flushTimer = null;
		}
		this.persistToDisk();
	}

	loadFromDisk() {
		if (!this._persistPath) return;
		let raw;
		try {
			raw = fs.readFileSync(this._persistPath, "utf8");
		} catch (e) {
			if (e?.code === "ENOENT") return;
			throw e;
		}

		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return;
		}

		if (
			!parsed ||
			parsed.v !== CACHE_FORMAT_VERSION ||
			typeof parsed.entries !== "object"
		) {
			return;
		}

		const now = Date.now() / 1000;
		const order = Array.isArray(parsed.order)
			? parsed.order
			: Object.keys(parsed.entries);

		for (const k of order) {
			const row = parsed.entries[k];
			if (
				!row ||
				typeof row.expire !== "number" ||
				row.expire <= now ||
				!Array.isArray(row.labels) ||
				!Array.isArray(row.comments)
			) {
				continue;
			}
			this._store.set(k, {
				expire: row.expire,
				labels: structuredClone(row.labels),
				comments: structuredClone(row.comments),
			});
		}
	}

	persistToDisk() {
		if (!this._persistPath) return;
		const dir = path.dirname(this._persistPath);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

		// Entries were already deep-cloned at `set()` time and aren't exposed
		// without cloning again at `get()`, so it's safe to serialize the
		// store object directly.
		const entries = Object.fromEntries(this._store);

		const payload = JSON.stringify({
			v: CACHE_FORMAT_VERSION,
			order: [...this._store.keys()],
			entries,
		});

		const tmp = `${this._persistPath}.${process.pid}.tmp`;
		try {
			fs.writeFileSync(tmp, payload, "utf8");
			fs.renameSync(tmp, this._persistPath);
		} catch (e) {
			try {
				fs.unlinkSync(tmp);
			} catch {
				// best effort
			}
			throw e;
		}
	}
}
