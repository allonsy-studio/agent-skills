import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as caching from "../scripts/caching.js";

/**
 * @param {Record<string, string | undefined>} env
 * @returns {() => void}
 */
function withEnv(env) {
	const prev = {};
	for (const k of Object.keys(env)) {
		prev[k] = process.env[k];
		if (env[k] === undefined) delete process.env[k];
		else process.env[k] = env[k];
	}
	return () => {
		for (const k of Object.keys(env)) {
			if (prev[k] === undefined) delete process.env[k];
			else process.env[k] = prev[k];
		}
	};
}

test("readCacheSettings parses TTL and max entries from env", () => {
	const restore = withEnv({
		GH_NOTIFICATION_CACHE_TTL: "90",
		GH_NOTIFICATION_CACHE_MAX: "10",
		GH_NOTIFICATION_CACHE_PERSIST: "0",
	});
	try {
		const s = caching.readCacheSettings();
		assert.equal(s.ttl, 90);
		assert.equal(s.maxEntries, 10);
		assert.equal(s.persistPath, null);
	} finally {
		restore();
	}
});

test("readCacheSettings falls back when env is invalid", () => {
	const restore = withEnv({
		GH_NOTIFICATION_CACHE_TTL: "not-a-number",
		GH_NOTIFICATION_CACHE_MAX: "x",
		GH_NOTIFICATION_CACHE_PERSIST: "0",
	});
	try {
		const s = caching.readCacheSettings();
		assert.equal(s.ttl, 3600);
		assert.equal(s.maxEntries, 256);
	} finally {
		restore();
	}
});

test("readCacheSettings clamps max entries to at least 1", () => {
	const restore = withEnv({
		GH_NOTIFICATION_CACHE_MAX: "0",
		GH_NOTIFICATION_CACHE_PERSIST: "0",
	});
	try {
		const s = caching.readCacheSettings();
		assert.equal(s.maxEntries, 1);
	} finally {
		restore();
	}
});

test("getCache returns null when TTL is zero", () => {
	const restore = withEnv({
		GH_NOTIFICATION_CACHE_TTL: "0",
		GH_NOTIFICATION_CACHE_PERSIST: "0",
	});
	try {
		caching.resetCache();
		assert.equal(caching.getCache(), null);
	} finally {
		restore();
		caching.resetCache();
	}
});

test("getCache recreates when settings key changes", () => {
	const restore = withEnv({
		GH_NOTIFICATION_CACHE_TTL: "120",
		GH_NOTIFICATION_CACHE_MAX: "256",
		GH_NOTIFICATION_CACHE_PERSIST: "0",
	});
	try {
		caching.resetCache();
		const a = caching.getCache();
		assert.ok(a);
		process.env.GH_NOTIFICATION_CACHE_TTL = "121";
		const b = caching.getCache();
		assert.notEqual(a, b);
	} finally {
		restore();
		caching.resetCache();
	}
});

test("Cache get returns null for missing key", () => {
	const cache = new caching.Cache(300, 32);
	assert.equal(cache.get("nope"), null);
});

test("Cache set and get returns cloned data", () => {
	const cache = new caching.Cache(300, 32);
	const labels = [{ name: "a", color: "ff0000" }];
	const comments = [{ author: "u", when: "t", body: "x" }];
	cache.set("k", labels, comments);
	const hit = cache.get("k");
	assert.ok(hit);
	assert.notEqual(hit.labels, labels);
	hit.labels[0].name = "mutated";
	assert.equal(labels[0].name, "a");
});

test("Cache LRU evicts oldest when at capacity", () => {
	const cache = new caching.Cache(300, 2);
	cache.set("a", [], []);
	cache.set("b", [], []);
	cache.set("c", [], []);
	assert.equal(cache.get("a"), null);
	assert.ok(cache.get("b"));
	assert.ok(cache.get("c"));
});

test("Cache get refreshes LRU order", () => {
	const cache = new caching.Cache(300, 2);
	cache.set("a", [], []);
	cache.set("b", [], []);
	cache.get("a");
	cache.set("c", [], []);
	assert.ok(cache.get("a"));
	assert.equal(cache.get("b"), null);
	assert.ok(cache.get("c"));
});

test("Cache expires entries after TTL", async () => {
	const cache = new caching.Cache(0.05, 32);
	cache.set("k", [], []);
	await new Promise((r) => setTimeout(r, 80));
	assert.equal(cache.get("k"), null);
});

test("readCacheSettings uses XDG_CACHE_HOME when GH_NOTIFICATION_CACHE_DIR is unset", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-xdg-"));
	const restore = withEnv({
		GH_NOTIFICATION_CACHE_PERSIST: "1",
		GH_NOTIFICATION_CACHE_DIR: undefined,
		XDG_CACHE_HOME: dir,
	});
	try {
		const s = caching.readCacheSettings();
		assert.equal(
			s.persistPath,
			path.join(dir, "gh-notification-summary", "enrichment-cache.json"),
		);
	} finally {
		restore();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("readCacheSettings resolves persist path when enabled", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const restore = withEnv({
		GH_NOTIFICATION_CACHE_PERSIST: "1",
		GH_NOTIFICATION_CACHE_DIR: dir,
	});
	try {
		const s = caching.readCacheSettings();
		assert.equal(s.persistPath, path.join(dir, "enrichment-cache.json"));
	} finally {
		restore();
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache persists entries across instances", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const file = path.join(dir, "enrichment-cache.json");
	try {
		const labels = [{ name: "bug", color: "ff0000" }];
		const c1 = new caching.Cache(3600, 32, file);
		c1.set("owner/repo#42:2024-01-01T00:00:00.000Z:0", labels, []);
		c1.flush();
		const c2 = new caching.Cache(3600, 32, file);
		const hit = c2.get("owner/repo#42:2024-01-01T00:00:00.000Z:0");
		assert.ok(hit);
		assert.equal(hit.labels[0].name, "bug");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache drops expired rows when loading from disk", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const file = path.join(dir, "enrichment-cache.json");
	try {
		const c1 = new caching.Cache(0.05, 32, file);
		c1.set("stale", [], []);
		c1.flush();
		await new Promise((r) => setTimeout(r, 80));
		const c2 = new caching.Cache(300, 32, file);
		assert.equal(c2.get("stale"), null);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache debounce coalesces multiple sets into a single disk write", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const file = path.join(dir, "enrichment-cache.json");
	try {
		const c = new caching.Cache(3600, 32, file);
		// Multiple sets before the timer fires should produce one final write.
		c.set("a", [{ name: "x", color: "ededed" }], []);
		c.set("b", [{ name: "y", color: "ededed" }], []);
		c.set("c", [{ name: "z", color: "ededed" }], []);
		assert.equal(
			fs.existsSync(file),
			false,
			"file should not exist yet — write is debounced"
		);
		// Wait for the macrotask scheduled by the debounced flush.
		await new Promise((r) => setTimeout(r, 10));
		assert.equal(fs.existsSync(file), true);
		const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
		assert.deepEqual(parsed.order, ["a", "b", "c"]);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache expired-on-get triggers debounced write", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const file = path.join(dir, "enrichment-cache.json");
	try {
		const c = new caching.Cache(0.05, 32, file);
		c.set("k", [], []);
		c.flush();
		await new Promise((r) => setTimeout(r, 80));
		// `get` on an expired key deletes it and schedules a flush.
		assert.equal(c.get("k"), null);
		await new Promise((r) => setTimeout(r, 10));
		const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
		assert.deepEqual(parsed.order, []);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache loadFromDisk ignores corrupted JSON", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const file = path.join(dir, "enrichment-cache.json");
	try {
		fs.writeFileSync(file, "{not-json", "utf8");
		// Should NOT throw — corrupted file is silently ignored.
		const c = new caching.Cache(3600, 32, file);
		assert.equal(c.get("anything"), null);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache loadFromDisk ignores wrong format version", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const file = path.join(dir, "enrichment-cache.json");
	try {
		fs.writeFileSync(
			file,
			JSON.stringify({ v: 999, order: [], entries: {} }),
			"utf8"
		);
		const c = new caching.Cache(3600, 32, file);
		assert.equal(c.get("anything"), null);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache loadFromDisk ignores malformed entries", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const file = path.join(dir, "enrichment-cache.json");
	try {
		const now = Date.now() / 1000;
		fs.writeFileSync(
			file,
			JSON.stringify({
				v: 1,
				order: ["bad-expire", "non-array-labels", "good"],
				entries: {
					"bad-expire": { expire: "soon", labels: [], comments: [] },
					"non-array-labels": { expire: now + 60, labels: "x", comments: [] },
					good: { expire: now + 60, labels: [{ name: "a", color: "fff" }], comments: [] },
				},
			}),
			"utf8"
		);
		const c = new caching.Cache(3600, 32, file);
		assert.equal(c.get("bad-expire"), null);
		assert.equal(c.get("non-array-labels"), null);
		const hit = c.get("good");
		assert.ok(hit);
		assert.equal(hit.labels[0].name, "a");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache loadFromDisk rethrows on non-ENOENT read errors", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	// Use the directory itself as the "file" path so readFileSync throws EISDIR.
	try {
		assert.throws(() => new caching.Cache(3600, 32, dir));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Cache persistToDisk cleans up tmp file on write failure", () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-cache-"));
	const file = path.join(dir, "enrichment-cache.json");
	try {
		const c = new caching.Cache(3600, 32, file);
		c.set("k", [], []);
		c.flush();
		assert.ok(fs.existsSync(file));

		// Now make the destination directory unwritable mid-flight: replace
		// the persist path so renameSync fails (target dir doesn't exist).
		c._persistPath = path.join(dir, "missing-subdir", "cache.json");
		// Pre-emptively recreate the dir then nuke it so writeFileSync to tmp
		// happens but renameSync to the (now-deleted) target fails.
		const subdir = path.join(dir, "missing-subdir");
		fs.mkdirSync(subdir);
		// Replace renameSync with one that always errors.
		const origRename = fs.renameSync;
		fs.renameSync = () => {
			throw new Error("synthetic rename failure");
		};
		try {
			assert.throws(() => c.persistToDisk());
			// tmp file should be cleaned up.
			const leftovers = fs
				.readdirSync(subdir)
				.filter((n) => n.endsWith(".tmp"));
			assert.equal(leftovers.length, 0);
		} finally {
			fs.renameSync = origRename;
		}
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
