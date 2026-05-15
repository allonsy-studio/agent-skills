/**
 * GitHub notifications: pure helpers, enrichment, dashboard render, and a
 * `Notifications` class that loads from real API or fixture data.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────────────────────────────────
// Token / repo helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * @param {string} token
 * @returns {string}
 */
export function maskToken(token) {
	if (!token) return "";
	return token.slice(0, 4) + "*".repeat(Math.max(0, token.length - 4));
}

/**
 * Parse an "owner/repo" string. Malformed inputs return empty fields rather
 * than throwing.
 *
 * @param {string} input
 * @returns {{ owner: string, repo: string }}
 */
export function parseRepo(input) {
	if (typeof input !== "string") return { owner: "", repo: "" };
	const cleaned = input
		.trim()
		.replace(/^https?:\/\//, "")
		.replace(/^api\.github\.com\/repos\//, "")
		.replace(/^\/+|\/+$/g, "");
	const parts = cleaned.split("/");
	if (parts.length !== 2 || !parts[0] || !parts[1]) {
		return { owner: "", repo: "" };
	}
	return { owner: parts[0], repo: parts[1] };
}

// ──────────────────────────────────────────────────────────────────────
// Date formatting
// ──────────────────────────────────────────────────────────────────────

/**
 * Apply a token-based format string to a Date. Tokens:
 *   YYYY, MM, DD, HH, mm, ss, SSS, Z (Z always literal "Z").
 * Without a format token list, returns the ISO string.
 *
 * @param {Date} d
 * @param {string} [format]
 * @returns {string}
 */
function applyDateFormat(d, format) {
	if (!format) return d.toISOString();

	// Any format requesting milliseconds (`SSS`) or a literal `Z` collapses to
	// the canonical ISO string; otherwise apply tokens.
	if (/SSS/.test(format) || /Z/.test(format)) return d.toISOString();

	const pad = (n, w = 2) => String(n).padStart(w, "0");
	return format
		.replace(/YYYY/g, String(d.getUTCFullYear()))
		.replace(/MM/g, pad(d.getUTCMonth() + 1))
		.replace(/DD/g, pad(d.getUTCDate()))
		.replace(/HH/g, pad(d.getUTCHours()))
		.replace(/mm/g, pad(d.getUTCMinutes()))
		.replace(/ss/g, pad(d.getUTCSeconds()));
}

/**
 * Format a date as a human-readable string. Empty/null input returns "".
 * Without a format, defaults to "Month D, YYYY at H:MM AM/PM UTC".
 *
 * @param {string|Date|null|undefined} input
 * @param {string} [format]
 * @returns {string}
 */
export function relativeTime(input, format) {
	if (input === null || input === undefined || input === "") return "";
	const d = input instanceof Date ? input : new Date(input);
	if (Number.isNaN(d.getTime())) return "";

	if (format) return applyDateFormat(d, format);

	const months = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December",
	];
	const Y = d.getUTCFullYear();
	const M = months[d.getUTCMonth()];
	const D = d.getUTCDate();
	let H = d.getUTCHours();
	const m = d.getUTCMinutes();
	const ampm = H >= 12 ? "PM" : "AM";
	H = H % 12;
	if (H === 0) H = 12;
	const mm = String(m).padStart(2, "0");
	return `${M} ${D}, ${Y} at ${H}:${mm} ${ampm} UTC`;
}

/**
 * @param {string|Date} input
 * @param {string} [format]
 * @returns {string}
 */
export function date(input, format) {
	const d = input instanceof Date ? input : new Date(input);
	if (Number.isNaN(d.getTime())) return "";
	return applyDateFormat(d, format);
}

/**
 * Pass-through formatter for ISO-ish date strings — used by templates.
 *
 * @param {string} input
 * @returns {string}
 */
export function date_relative(input) {
	if (typeof input === "string") return input;
	if (input instanceof Date) return input.toISOString();
	return "";
}

// ──────────────────────────────────────────────────────────────────────
// Notification URL helpers
// ──────────────────────────────────────────────────────────────────────

/**
 * Extract the trailing numeric segment from a GitHub API subject URL.
 *
 * @param {string} url
 * @returns {string}
 */
export function subjectNumber(url) {
	if (typeof url !== "string") return "";
	const m = url.replace(/\/+$/, "").match(/(\d+)$/);
	return m ? m[1] : "";
}

/**
 * Convert a GitHub API subject URL to its html_url equivalent.
 *
 * @param {string} url
 * @returns {string}
 */
export function subjectHtmlUrl(url) {
	if (typeof url !== "string") return "";
	return url
		.replace(/^https?:\/\/api\.github\.com\/repos\//, "https://github.com/")
		.replace(/\/pulls\//, "/pull/");
}

/**
 * Pull the trailing comment ID from a notification's `latest_comment_url`.
 * Returns 0 when missing or non-numeric.
 *
 * @param {{ subject?: { latest_comment_url?: string|null } }} notification
 * @returns {number}
 */
export function latestCommentIdFromNotification(notification) {
	const url = notification?.subject?.latest_comment_url;
	if (!url || typeof url !== "string") return 0;
	const m = url.replace(/\/+$/, "").match(/(\d+)$/);
	return m ? Number(m[1]) : 0;
}

/**
 * Parse an updated_at into a Date used as the "since" cutoff for comments.
 * Invalid inputs fall back to the current time.
 *
 * @param {string|Date|null|undefined} input
 * @returns {Date}
 */
export function commentSinceCutoff(input) {
	if (input instanceof Date && !Number.isNaN(input.getTime())) return input;
	if (typeof input === "string" && input.trim()) {
		const d = new Date(input);
		if (!Number.isNaN(d.getTime())) return d;
	}
	return new Date();
}

// ──────────────────────────────────────────────────────────────────────
// Cache keys / progress refs
// ──────────────────────────────────────────────────────────────────────

/**
 * Composite cache key for a single notification's enrichment payload.
 * Lowercases the repo so case differences don't fragment the cache.
 *
 * @param {string} repoFullName
 * @param {string|number} issueNumber
 * @param {Date|string} since
 * @param {number|string} latestCommentId
 * @returns {string}
 */
export function cacheKey(repoFullName, issueNumber, since, latestCommentId) {
	const repo = String(repoFullName ?? "").toLowerCase();
	const num = String(issueNumber ?? "");
	const sinceIso =
		since instanceof Date
			? since.toISOString()
			: String(since ?? "");
	const lcId = String(latestCommentId ?? 0);
	return `${repo}#${num}:${sinceIso}:${lcId}`;
}

/**
 * Best-effort human-readable label for enrichment progress.
 *
 * @param {object} notification
 * @param {object} card
 * @param {number} idx
 * @returns {string}
 */
export function enrichmentProgressRef(notification, card, idx) {
	if (card?.repo_full_name && card?.issue_number) {
		return `${card.repo_full_name}#${card.issue_number}`;
	}
	if (notification?.subject?.title) return notification.subject.title;
	if (card?.notif_id) return String(card.notif_id);
	return String(idx);
}

// ──────────────────────────────────────────────────────────────────────
// Dashboard HTML render
// ──────────────────────────────────────────────────────────────────────

/**
 * Render a minimal HTML dashboard from a Notifications-shaped instance.
 *
 * @param {{ notifications: object[] }} instance
 * @param {string} [repoFilter]
 * @returns {string}
 */
export function renderDashboardHtml(instance, repoFilter) {
	const list = Array.isArray(instance?.notifications)
		? instance.notifications
		: [];
	const filtered = repoFilter
		? list.filter((n) => n?.repo_full_name === repoFilter)
		: list;

	if (filtered.length === 0) {
		return `<!doctype html><html><body><main><p class="empty">All clear — no unread notifications.</p></main></body></html>`;
	}

	const esc = (s) =>
		String(s ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");

	const cards = filtered
		.map((n) => {
			const labelChips = (n.labels ?? [])
				.map(
					(l) =>
						`<span class="label" style="background:#${esc(l.color ?? "ededed")}">${esc(l.name ?? "")}</span>`
				)
				.join("");
			const comments = (n.comments ?? [])
				.map(
					(c) =>
						`<li><span class="user">${esc(c?.user?.login ?? c?.author ?? "")}</span> at <time>${esc(c?.created_at ?? "")}</time>: ${esc(c?.body ?? "")}</li>`
				)
				.join("");
			return `<article class="card" data-repo="${esc(n.repo_full_name ?? "")}" data-reason="${esc(n.reason ?? "")}">
				<h2><a href="${esc(subjectHtmlUrl(n.issue_url ?? ""))}">${esc(n.title ?? "")}</a></h2>
				<p class="meta">#${esc(n.issue_number ?? "")} · ${esc(n.reason ?? "")} · ${esc(n.updated_at ?? "")}</p>
				<div class="labels">${labelChips}</div>
				<ul class="comments">${comments}</ul>
			</article>`;
		})
		.join("");

	return `<!doctype html><html><body><main>${cards}</main></body></html>`;
}

// ──────────────────────────────────────────────────────────────────────
// Enrichment
// ──────────────────────────────────────────────────────────────────────

const ENRICHABLE_SUBJECT_TYPES = new Set(["Issue", "PullRequest"]);

/**
 * Enrich a single notification "card" with labels and comments from GitHub.
 * Updates the card in place. Returns `{ cached }` or null if the subject is
 * not enrichable.
 *
 * @param {object} octokit - Octokit instance.
 * @param {object} notification - Raw notification.
 * @param {object} card - The mutable card to enrich.
 * @param {{ useCache?: boolean, cache?: Cache | null }} [opts]
 * @returns {Promise<{cached: boolean} | null>}
 */
export async function getNotificationContext(octokit, notification, card, opts = {}) {
	const subjectType = notification?.subject?.type;
	if (!ENRICHABLE_SUBJECT_TYPES.has(subjectType)) return null;
	if (!card?.issue_number) return null;

	const useCache = opts.useCache !== false;
	const cache = useCache ? (opts.cache ?? null) : null;
	const since = commentSinceCutoff(notification?.updated_at);
	const lcId = latestCommentIdFromNotification(notification);
	const key = cacheKey(card.repo_full_name, card.issue_number, since, lcId);

	if (cache) {
		const hit = cache.get(key);
		if (hit) {
			card.labels = hit.labels;
			card.comments = hit.comments;
			return { cached: true };
		}
	}

	const { owner, repo } = parseRepo(card.repo_full_name ?? "");
	if (!owner || !repo) return null;

	const [issueRes, listRes] = await Promise.all([
		octokit.rest.issues.get({
			owner,
			repo,
			issue_number: card.issue_number,
		}),
		octokit.rest.issues.listComments({
			owner,
			repo,
			issue_number: card.issue_number,
			since: since.toISOString(),
			per_page: 100,
		}),
	]);

	const rawLabels = issueRes?.data?.labels ?? [];
	const labels = rawLabels.map((l) => {
		const name = typeof l === "string" ? l : l?.name ?? "";
		let color =
			typeof l === "object" && l?.color
				? String(l.color).replace(/^#/, "")
				: "ededed";
		if (color.length !== 6) color = "ededed";
		return { name, color };
	});

	let comments = Array.isArray(listRes?.data) ? listRes.data.slice() : [];

	// If the notification points at a latest_comment_url not in the listing,
	// fetch it directly so the dashboard reflects what GitHub considered the
	// trigger for the notification.
	if (lcId && !comments.some((c) => Number(c?.id) === lcId)) {
		try {
			const cRes = await octokit.rest.issues.getComment({
				owner,
				repo,
				comment_id: lcId,
			});
			if (cRes?.data) comments.push(cRes.data);
		} catch {
			// best effort
		}
	}

	card.labels = labels;
	card.comments = comments;

	if (cache) cache.set(key, labels, comments);

	return { cached: false };
}

/**
 * Enrich a batch of notifications in parallel (bounded concurrency).
 *
 * @param {object} octokit
 * @param {object[]} notifications
 * @param {object[]} cards
 * @param {{
 *   enrichMaxWorkers?: number,
 *   useCache?: boolean,
 *   cache?: Cache | null,
 *   onEnrichProgress?: (info: { cached: boolean, ref: string }) => void,
 * }} [opts]
 * @returns {Promise<object[]>}
 */
export async function getNotificationRows(
	octokit,
	notifications,
	cards,
	opts = {}
) {
	const workers = Math.max(1, Math.floor(opts.enrichMaxWorkers ?? 4));
	const progress = opts.onEnrichProgress;

	let next = 0;
	async function pump() {
		while (true) {
			const i = next++;
			if (i >= notifications.length) return;
			const n = notifications[i];
			const card = cards[i];
			const r = await getNotificationContext(octokit, n, card, opts);
			if (r && progress) {
				progress({ cached: r.cached, ref: enrichmentProgressRef(n, card, i) });
			}
		}
	}

	const lanes = Array.from({ length: Math.min(workers, notifications.length) }, () =>
		pump()
	);
	await Promise.all(lanes);
	return cards;
}

// ──────────────────────────────────────────────────────────────────────
// Thread lookup / unsubscribe / mark-done
// ──────────────────────────────────────────────────────────────────────

/**
 * Find the GitHub notification thread ID for an issue/PR by paginating the
 * authenticated user's notifications and matching on subject URL.
 *
 * @param {object} octokit
 * @param {string} repoFullName
 * @param {string|number} issueNumber
 * @returns {Promise<string|null>}
 */
export async function findThreadIdForIssue(octokit, repoFullName, issueNumber) {
	const repoLower = String(repoFullName ?? "").toLowerCase();
	const issueStr = String(issueNumber ?? "");
	const iter = octokit.paginate.iterator(
		octokit.rest.activity.listNotificationsForAuthenticatedUser,
		{ all: true, per_page: 100 }
	);
	for await (const page of iter) {
		const rows = Array.isArray(page?.data) ? page.data : [];
		for (const row of rows) {
			const rowRepo = String(row?.repository?.full_name ?? "").toLowerCase();
			if (rowRepo !== repoLower) continue;
			const subjectUrl = row?.subject?.url ?? "";
			const num = subjectNumber(subjectUrl);
			if (num === issueStr) return row.id ?? null;
		}
	}
	return null;
}

/**
 * Validate inputs, find the thread, and delete subscription + thread.
 *
 * @param {object} octokit
 * @param {string} repoFullName
 * @param {string|number} issueNumber
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function performUnsub(octokit, repoFullName, issueNumber) {
	if (!repoFullName || typeof repoFullName !== "string") {
		return { ok: false, error: "Repository is required" };
	}
	// GitHub issue numbers are positive integers — reject fractional, negative,
	// and non-numeric inputs.
	const issueStr = String(issueNumber ?? "").trim();
	if (!/^\d+$/.test(issueStr) || issueStr === "0") {
		return { ok: false, error: "Issue number must be a number" };
	}

	const threadId = await findThreadIdForIssue(octokit, repoFullName, issueNumber);
	if (!threadId) {
		return {
			ok: false,
			error: "No matching notification thread for this issue",
		};
	}

	await octokit.request("DELETE /notifications/threads/{thread_id}/subscription", {
		thread_id: threadId,
	});
	await octokit.request("DELETE /notifications/threads/{thread_id}", {
		thread_id: threadId,
	});

	return { ok: true };
}

/**
 * Mark a single issue's notification thread as done.
 *
 * @param {object} octokit
 * @param {string} repoFullName
 * @param {string|number} issueNumber
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function markIssueNotificationDone(octokit, repoFullName, issueNumber) {
	const threadId = await findThreadIdForIssue(octokit, repoFullName, issueNumber);
	if (!threadId) {
		return {
			ok: false,
			error: "No matching notification thread for this issue",
		};
	}
	await octokit.request("DELETE /notifications/threads/{thread_id}", {
		thread_id: threadId,
	});
	return { ok: true };
}

/**
 * Mark every unread notification thread as done.
 *
 * @param {object} octokit
 * @returns {Promise<{ ok: boolean, count: number }>}
 */
export async function markAllNotificationsDone(octokit) {
	const iter = octokit.paginate.iterator(
		octokit.rest.activity.listNotificationsForAuthenticatedUser,
		{ all: true, per_page: 100 }
	);
	let count = 0;
	for await (const page of iter) {
		const rows = Array.isArray(page?.data) ? page.data : [];
		for (const row of rows) {
			if (!row?.id) continue;
			await octokit.request("DELETE /notifications/threads/{thread_id}", {
				thread_id: row.id,
			});
			count++;
		}
	}
	return { ok: true, count };
}

// ──────────────────────────────────────────────────────────────────────
// Notifications class
// ──────────────────────────────────────────────────────────────────────

/**
 * Holds an authenticated user's enriched notifications. In test mode, loads
 * deterministic fixture data instead of hitting GitHub.
 */
export class Notifications {
	/** @type {string} */
	user = "";
	/** @type {object[]} */
	notifications = [];
	/** @type {Promise<void>} */
	#ready;

	/**
	 * @param {string} token
	 * @param {{ testMode?: boolean, skipAI?: boolean, fixturePath?: string }} [opts]
	 */
	constructor(token, opts = {}) {
		const { testMode = false, fixturePath } = opts;

		if (!token && !testMode) {
			throw new Error("GitHub token is required (or set testMode: true).");
		}

		this.#ready = testMode
			? this.#loadFixtures(fixturePath)
			: Promise.resolve();
	}

	/**
	 * Wait for any in-flight initialization (e.g. fixture loading) to settle.
	 *
	 * @returns {Promise<void>}
	 */
	async awaitPromises() {
		await this.#ready;
	}

	/**
	 * Populate `user` and `notifications` from a JSON fixture file. Each
	 * notification entry is enriched with labels (from `issuesGet`) and a
	 * pre-computed AI summary (from `getAISummaryByIssue`).
	 */
	async #loadFixtures(fixturePath) {
		const { readFileSync } = await import("node:fs");
		const file =
			fixturePath ??
			process.env.GITHUB_TEST_FIXTURE_PATH?.trim() ??
			path.resolve(
				__dirname,
				"..",
				"tests",
				"fixtures",
				"octokit-responses.json"
			);

		const fixtures = JSON.parse(readFileSync(file, "utf8"));
		this.user = fixtures.usersGetAuthenticated?.data?.login ?? "";

		const rows = Array.isArray(fixtures.listNotificationsForAuthenticatedUser)
			? fixtures.listNotificationsForAuthenticatedUser
			: [];
		const issuesGet = fixtures.issuesGet ?? {};
		const summaries = fixtures.getAISummaryByIssue ?? {};

		this.notifications = rows.map((row) => {
			const repoFull = row?.repository?.full_name ?? "";
			const number = subjectNumber(row?.subject?.url ?? "");
			const key = `${repoFull}#${number}`;

			const issueData = issuesGet[key]?.data ?? {};
			const labels = (issueData.labels ?? []).map((l) => ({
				name: typeof l === "string" ? l : l?.name ?? "",
				color:
					typeof l === "object" && l?.color
						? String(l.color).replace(/^#/, "")
						: "ededed",
			}));

			return {
				thread_id: row.id,
				notif_id: row.id,
				repo_full_name: repoFull,
				issue_number: number,
				number,
				title: row?.subject?.title ?? "",
				subject_type: row?.subject?.type ?? "",
				issue_url: row?.subject?.url ?? "",
				reason: row?.reason ?? "",
				updated_at: row?.updated_at ?? "",
				unread: row?.unread ?? false,
				labels,
				comments: [],
				summary: summaries[key] ?? "",
			};
		});
	}
}
