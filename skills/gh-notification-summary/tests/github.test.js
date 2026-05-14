import assert from "node:assert/strict";
import { mock } from "node:test";
import test from "node:test";

import * as caching from "../scripts/caching.js";
import * as core from "../scripts/github.js";

test("relativeTime empty input", () => {
	assert.equal(core.relativeTime(""), "");
	assert.equal(core.relativeTime(null), "");
});

test("relativeTime formats UTC string", () => {
	const s = core.relativeTime("2024-06-01T15:30:00.000Z");
	assert.ok(s.includes("2024"));
	assert.ok(s.includes("UTC"));
});

test("relativeTime formats date object", () => {
	const d = new Date("2024-06-01T15:30:00.000Z");
	const s = core.relativeTime(d);
	assert.ok(s.includes("2024"));
	assert.ok(s.includes("UTC"));
});

test("relativeTime formats date object with format", () => {
	const d = new Date("2024-06-01T15:30:00.000Z");
	const s = core.relativeTime(d);
	assert.equal(s, "June 1, 2024 at 3:30 PM UTC");
	const s2 = core.relativeTime(d, "YYYY-MM-DD");
	assert.equal(s2, "2024-06-01");
	const s3 = core.relativeTime(d, "YYYY-MM-DDTHH:mm:ssZ");
	assert.equal(s3, "2024-06-01T15:30:00.000Z");
	const s4 = core.relativeTime(d, "YYYY-MM-DDTHH:mm:ss");
	assert.equal(s4, "2024-06-01T15:30:00");
	const s5 = core.relativeTime(d, "YYYY-MM-DDTHH:mm:ss.SSS");
	assert.equal(s5, "2024-06-01T15:30:00.000Z");
	const s6 = core.relativeTime(d, "YYYY-MM-DDTHH:mm:ss.SSSZ");
	assert.equal(s6, "2024-06-01T15:30:00.000Z");
});

test("date formats date object with format", () => {
	const d = new Date("2024-06-01T15:30:00.000Z");
	const s = core.date(d);
	assert.equal(s, "2024-06-01T15:30:00.000Z");
	const s2 = core.date(d, "YYYY-MM-DD");
	assert.equal(s2, "2024-06-01");
	const s3 = core.date(d, "YYYY-MM-DDTHH:mm:ssZ");
	assert.equal(s3, "2024-06-01T15:30:00.000Z");
	const s4 = core.date(d, "YYYY-MM-DDTHH:mm:ss");
	assert.equal(s4, "2024-06-01T15:30:00");
	const s5 = core.date(d, "YYYY-MM-DDTHH:mm:ss.SSS");
	assert.equal(s5, "2024-06-01T15:30:00.000Z");
});

test("date_relative formats date string with format", () => {
	const s = core.date_relative("2024-06-01T15:30:00.000Z");
	assert.equal(s, "2024-06-01T15:30:00.000Z");
});


test("subjectNumber and subjectHtmlUrl", () => {
	assert.equal(
		core.subjectNumber("https://api.github.com/repos/o/r/issues/42"),
		"42",
	);
	assert.equal(
		core.subjectHtmlUrl("https://api.github.com/repos/o/r/pulls/99"),
		"https://github.com/o/r/pull/99",
	);
});

test("parseRepo", () => {
	assert.deepEqual(core.parseRepo("owner/repo"), { owner: "owner", repo: "repo" });
	assert.deepEqual(core.parseRepo("nope"), { owner: "", repo: "" });
	assert.deepEqual(core.parseRepo("/only"), { owner: "", repo: "" });
});

test("commentSinceCutoff invalid date falls back to now", () => {
	const d = core.commentSinceCutoff("not-a-date");
	assert.ok(d instanceof Date);
	assert.ok(!Number.isNaN(d.getTime()));
});

test("latestCommentIdFromNotification", () => {
	const u =
		"https://api.github.com/repos/octocat/Hello-World/issues/comments/99";
	assert.equal(
		core.latestCommentIdFromNotification({
			subject: { latest_comment_url: u },
		}),
		99,
	);
	assert.equal(
		core.latestCommentIdFromNotification({ subject: {} }),
		0,
	);
});

test("cacheKey normalizes repo case", () => {
	const s = new Date("2024-01-01T12:00:00.000Z");
	const k1 = core.cacheKey("Owner/Repo", "42", s, 0);
	const k2 = core.cacheKey("owner/repo", "42", s, 0);
	assert.equal(k1, k2);
});

test("enrichmentProgressRef prefers repo#num", () => {
	const n = { subject: { title: "T" } };
	const card = { repo_full_name: "o/r", issue_number: "7", notif_id: "1" };
	assert.equal(core.enrichmentProgressRef(n, card, 0), "o/r#7");
});

test("renderDashboardHtml empty cards", () => {
	const html = core.renderDashboardHtml({ notifications: [] }, "");
	assert.ok(html.includes("All clear"));
});

test("renderDashboardHtml single notification shape", () => {
	const instance = { notifications: [
		{
			title: "T",
			reason: "mention",
			updated_at: new Date().toISOString(),
			notif_id: "1",
			issue_number: "42",
			issue_url: "https://api.github.com/repos/o/r/issues/42",
			subject_type: "Issue",
			repo_full_name: "o/r",
			labels: [{ name: "bug", color: "ff0000" }],
			comments: [{ id: 1, created_at: "2024-01-01T00:00:00Z", user: { login: "u1" }, body: "c1" }],
			unread: true,
		},
	] };
	const html = core.renderDashboardHtml(instance, "o/r");
	assert.ok(html.includes("T"));
	assert.ok(html.includes("#42"));
	assert.ok(html.includes("mention"));
	assert.ok(html.includes("bug"));
	assert.ok(html.includes("c1"));
	assert.ok(html.includes("u1"));
	assert.ok(html.includes("2024-01-01T00:00:00Z"));
});

test("getNotificationContext returns null when subject not enrichable", async () => {
	const card = { repo_full_name: "o/r", issue_number: "1", labels: [], comments: [] };
	const r = await core.getNotificationContext(
		{},
		{ subject: { type: "Release" }, updated_at: new Date().toISOString() },
		card,
		{ useCache: false },
	);
	assert.equal(r, null);
});

test("getNotificationContext returns null when issue number missing", async () => {
	const card = { repo_full_name: "o/r", issue_number: "", labels: [], comments: [] };
	const r = await core.getNotificationContext(
		{},
		{
			subject: { type: "Issue", url: "https://api.github.com/repos/o/r/issues/1" },
			updated_at: new Date().toISOString(),
		},
		card,
		{ useCache: false },
	);
	assert.equal(r, null);
});

test("getNotificationContext fetches issue and caches", async () => {
	caching.resetCache();
	const cache = new caching.Cache(300, 32);
	const octokit = {
		rest: {
			issues: {
				get: mock.fn(async () => ({
					data: { labels: [{ name: "bug", color: "ff0000" }] },
				})),
				listComments: mock.fn(async () => ({
					data: [
						{
							id: 1,
							created_at: "2024-01-01T00:00:00Z",
							user: { login: "u1" },
							body: "c1",
						},
					],
				})),
			},
		},
	};
	const n = {
		subject: {
			type: "Issue",
			url: "https://api.github.com/repos/o/r/issues/5",
			latest_comment_url: null,
		},
		updated_at: new Date().toISOString(),
	};
	const card = {
		repo_full_name: "o/r",
		issue_number: "5",
		labels: [],
		comments: [],
	};
	const r1 = await core.getNotificationContext(octokit, n, card, {
		useCache: true,
		cache: cache,
	});
	assert.equal(r1?.cached, false);
	assert.equal(card.labels[0].name, "bug");
	assert.equal(card.comments.length, 1);
	// Verify we asked for the right issue, not just *some* issue.
	assert.deepEqual(octokit.rest.issues.get.mock.calls[0].arguments[0], {
		owner: "o",
		repo: "r",
		issue_number: "5",
	});

	const r2 = await core.getNotificationContext(octokit, n, card, {
		useCache: true,
		cache: cache,
	});
	assert.equal(r2?.cached, true);
	// On the cache hit, we should NOT make another API call.
	assert.equal(octokit.rest.issues.get.mock.callCount(), 1);
});

test("getNotificationContext fetches latest comment when not in list", async () => {
	const octokit = {
		rest: {
			issues: {
				get: mock.fn(async () => ({ data: { labels: [] } })),
				listComments: mock.fn(async () => ({ data: [] })),
				getComment: mock.fn(async () => ({
					data: {
						id: 50,
						created_at: "2024-01-02T00:00:00Z",
						user: { login: "ghost" },
						body: "extra",
					},
				})),
			},
		},
	};
	const lc =
		"https://api.github.com/repos/o/r/issues/comments/50";
	const n = {
		subject: {
			type: "Issue",
			url: "https://api.github.com/repos/o/r/issues/5",
			latest_comment_url: lc,
		},
		updated_at: new Date().toISOString(),
	};
	const card = {
		repo_full_name: "o/r",
		issue_number: "5",
		labels: [],
		comments: [],
	};
	await core.getNotificationContext(octokit, n, card, { useCache: false });
	// Verify the right comment was fetched, not just *a* comment.
	assert.deepEqual(octokit.rest.issues.getComment.mock.calls[0].arguments[0], {
		owner: "o",
		repo: "r",
		comment_id: 50,
	});
	assert.ok(card.comments.some((c) => c.body === "extra"));
});

test("getNotificationRows single worker calls progress", async () => {
	const octokit = {
		rest: {
			issues: {
				get: async () => ({ data: { labels: [] } }),
				listComments: async () => ({ data: [] }),
			},
		},
	};
	const now = new Date().toISOString();
	const notifications = [
		{
			subject: {
				type: "Issue",
				url: "https://api.github.com/repos/o/r/issues/1",
			},
			updated_at: now,
		},
	];
	const cards = [
		{
			repo_full_name: "o/r",
			issue_number: "1",
			labels: [],
			comments: [],
		},
	];
	const progress = mock.fn();
	await core.getNotificationRows(octokit, notifications, cards, {
		enrichMaxWorkers: 1,
		useCache: false,
		onEnrichProgress: progress,
	});
	assert.equal(progress.mock.callCount(), 1);
	assert.equal(progress.mock.calls[0].arguments[0].cached, false);
});

test("findThreadIdForIssue matches issue URL", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						data: [
							{
								id: "thread-1",
								repository: { full_name: "o/r" },
								subject: {
									url: "https://api.github.com/repos/o/r/issues/42",
								},
							},
						],
					};
				},
			}),
		},
		rest: {
			activity: {
				listNotificationsForAuthenticatedUser: () => {},
			},
		},
	};
	const tid = await core.findThreadIdForIssue(octokit, "o/r", 42);
	assert.equal(tid, "thread-1");
});

test("findThreadIdForIssue returns null when no match", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield { data: [] };
				},
			}),
		},
		rest: {
			activity: {
				listNotificationsForAuthenticatedUser: () => {},
			},
		},
	};
	const tid = await core.findThreadIdForIssue(octokit, "o/r", 99);
	assert.equal(tid, null);
});

test("performUnsub validation errors without network", async () => {
	const octokit = {};
	assert.deepEqual(await core.performUnsub(octokit, "r", "x"), {
		ok: false,
		error: "Issue number must be a number",
	});
	assert.deepEqual(await core.performUnsub(octokit, "", "1"), {
		ok: false,
		error: "Repository is required",
	});
});

test("performUnsub deletes subscription and thread on match", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						data: [
							{
								id: "tid",
								repository: { full_name: "O/R" },
								subject: {
									url: "https://api.github.com/repos/O/R/issues/7",
								},
							},
						],
					};
				},
			}),
		},
		rest: {
			activity: {
				listNotificationsForAuthenticatedUser: () => {},
			},
		},
		request: mock.fn(async () => {}),
	};
	const r = await core.performUnsub(octokit, "o/r", "7");
	assert.equal(r.ok, true);
	// Verify we hit *both* endpoints (subscription delete + thread delete) with
	// the matched thread_id — not just that we made two arbitrary calls.
	const calls = octokit.request.mock.calls.map((c) => c.arguments);
	assert.deepEqual(calls, [
		[
			"DELETE /notifications/threads/{thread_id}/subscription",
			{ thread_id: "tid" },
		],
		["DELETE /notifications/threads/{thread_id}", { thread_id: "tid" }],
	]);
});

test("markIssueNotificationDone deletes thread", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						data: [
							{
								id: "z",
								repository: { full_name: "a/b" },
								subject: {
									url: "https://api.github.com/repos/a/b/issues/2",
								},
							},
						],
					};
				},
			}),
		},
		rest: {
			activity: {
				listNotificationsForAuthenticatedUser: () => {},
			},
		},
		request: mock.fn(async () => {}),
	};
	const r = await core.markIssueNotificationDone(octokit, "a/b", "2");
	assert.equal(r.ok, true);
	assert.deepEqual(octokit.request.mock.calls[0].arguments, [
		"DELETE /notifications/threads/{thread_id}",
		{ thread_id: "z" },
	]);
});

test("markAllNotificationsDone iterates and deletes", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield { data: [{ id: "a" }, { id: "b" }] };
				},
			}),
		},
		rest: {
			activity: {
				listNotificationsForAuthenticatedUser: () => {},
			},
		},
		request: mock.fn(async () => {}),
	};
	const r = await core.markAllNotificationsDone(octokit);
	assert.equal(r.ok, true);
	const threadIds = octokit.request.mock.calls.map(
		(c) => c.arguments[1].thread_id,
	);
	assert.deepEqual(threadIds, ["a", "b"]);
	// All calls should hit the same endpoint.
	assert.ok(
		octokit.request.mock.calls.every(
			(c) => c.arguments[0] === "DELETE /notifications/threads/{thread_id}",
		),
	);
});

// ───────────────────────────────────────────────────────────────────────
// Input-type guards and branch coverage
// ───────────────────────────────────────────────────────────────────────

test("parseRepo rejects non-string and malformed inputs", () => {
	assert.deepEqual(core.parseRepo(null), { owner: "", repo: "" });
	assert.deepEqual(core.parseRepo(42), { owner: "", repo: "" });
	assert.deepEqual(core.parseRepo("only-one-segment"), { owner: "", repo: "" });
	assert.deepEqual(core.parseRepo("a/b/c"), { owner: "", repo: "" });
	// API URL prefix and trailing slashes are normalized.
	assert.deepEqual(core.parseRepo("api.github.com/repos/o/r/"), { owner: "o", repo: "r" });
});

test("subjectNumber returns empty string for non-string inputs", () => {
	assert.equal(core.subjectNumber(null), "");
	assert.equal(core.subjectNumber(undefined), "");
	assert.equal(core.subjectNumber(42), "");
	assert.equal(core.subjectNumber("no-digits"), "");
});

test("subjectHtmlUrl returns empty string for non-string inputs", () => {
	assert.equal(core.subjectHtmlUrl(null), "");
	assert.equal(core.subjectHtmlUrl(42), "");
});

test("latestCommentIdFromNotification handles malformed inputs", () => {
	assert.equal(core.latestCommentIdFromNotification(null), 0);
	assert.equal(core.latestCommentIdFromNotification({}), 0);
	assert.equal(
		core.latestCommentIdFromNotification({ subject: { latest_comment_url: 123 } }),
		0,
	);
	assert.equal(
		core.latestCommentIdFromNotification({
			subject: { latest_comment_url: "https://example.com/non-numeric/x" },
		}),
		0,
	);
});

test("relativeTime returns empty string for invalid inputs", () => {
	assert.equal(core.relativeTime(undefined), "");
	assert.equal(core.relativeTime("not-a-date"), "");
	assert.equal(core.relativeTime(new Date("nope")), "");
});

test("relativeTime formats noon and midnight correctly", () => {
	const noon = new Date("2024-06-01T12:00:00.000Z");
	assert.equal(core.relativeTime(noon), "June 1, 2024 at 12:00 PM UTC");
	const midnight = new Date("2024-06-01T00:00:00.000Z");
	assert.equal(core.relativeTime(midnight), "June 1, 2024 at 12:00 AM UTC");
});

test("date returns empty string for invalid input", () => {
	assert.equal(core.date("not-a-date"), "");
});

test("date_relative handles Date input and falls back for unknowns", () => {
	const d = new Date("2024-06-01T15:30:00.000Z");
	assert.equal(core.date_relative(d), "2024-06-01T15:30:00.000Z");
	assert.equal(core.date_relative(null), "");
	assert.equal(core.date_relative(42), "");
});

test("commentSinceCutoff accepts Date input directly", () => {
	const d = new Date("2024-01-01T00:00:00.000Z");
	const r = core.commentSinceCutoff(d);
	assert.equal(r.getTime(), d.getTime());
});

test("enrichmentProgressRef falls back through priority chain", () => {
	// no card fields, has subject title → title
	assert.equal(
		core.enrichmentProgressRef(
			{ subject: { title: "Some title" } },
			{ labels: [], comments: [] },
			3,
		),
		"Some title",
	);
	// no title, has notif_id → notif_id
	assert.equal(
		core.enrichmentProgressRef({}, { notif_id: "id-42", labels: [], comments: [] }, 3),
		"id-42",
	);
	// nothing → idx as string
	assert.equal(core.enrichmentProgressRef({}, {}, 7), "7");
});

test("renderDashboardHtml with non-array notifications shows All clear", () => {
	const html = core.renderDashboardHtml({}, "");
	assert.ok(html.includes("All clear"));
});

test("renderDashboardHtml repoFilter excluding everything shows All clear", () => {
	const html = core.renderDashboardHtml(
		{ notifications: [{ title: "x", repo_full_name: "a/b" }] },
		"other/repo",
	);
	assert.ok(html.includes("All clear"));
});

test("maskToken handles short and empty tokens", () => {
	assert.equal(core.maskToken(""), "");
	assert.equal(core.maskToken("ab"), "ab");
	assert.equal(core.maskToken("ghp_abcdef"), "ghp_******");
});

// ───────────────────────────────────────────────────────────────────────
// getNotificationContext additional branches
// ───────────────────────────────────────────────────────────────────────

test("getNotificationContext returns null when repo cannot be parsed", async () => {
	const card = { repo_full_name: "malformed", issue_number: "1", labels: [], comments: [] };
	const r = await core.getNotificationContext(
		{},
		{ subject: { type: "Issue", url: "https://api.github.com/repos/x/y/issues/1" }, updated_at: new Date().toISOString() },
		card,
		{ useCache: false },
	);
	assert.equal(r, null);
});

test("getNotificationContext swallows getComment errors", async () => {
	const octokit = {
		rest: {
			issues: {
				get: mock.fn(async () => ({ data: { labels: [] } })),
				listComments: mock.fn(async () => ({ data: [] })),
				getComment: mock.fn(async () => {
					throw new Error("rate limited");
				}),
			},
		},
	};
	const lc = "https://api.github.com/repos/o/r/issues/comments/50";
	const n = {
		subject: { type: "Issue", url: "https://api.github.com/repos/o/r/issues/5", latest_comment_url: lc },
		updated_at: new Date().toISOString(),
	};
	const card = { repo_full_name: "o/r", issue_number: "5", labels: [], comments: [] };
	const r = await core.getNotificationContext(octokit, n, card, { useCache: false });
	assert.equal(r?.cached, false);
	assert.equal(card.comments.length, 0); // getComment failed, no comment added
});

// ───────────────────────────────────────────────────────────────────────
// getNotificationRows edge cases
// ───────────────────────────────────────────────────────────────────────

test("getNotificationRows with zero notifications returns immediately", async () => {
	const r = await core.getNotificationRows({}, [], [], { enrichMaxWorkers: 4 });
	assert.deepEqual(r, []);
});

test("getNotificationRows clamps workers when notifications < workers", async () => {
	const octokit = {
		rest: {
			issues: {
				get: mock.fn(async () => ({ data: { labels: [] } })),
				listComments: mock.fn(async () => ({ data: [] })),
			},
		},
	};
	const notifs = [
		{ subject: { type: "Issue", url: "https://api.github.com/repos/o/r/issues/1" }, updated_at: new Date().toISOString() },
		{ subject: { type: "Issue", url: "https://api.github.com/repos/o/r/issues/2" }, updated_at: new Date().toISOString() },
	];
	const cards = notifs.map((_, i) => ({
		repo_full_name: "o/r",
		issue_number: String(i + 1),
		labels: [],
		comments: [],
	}));
	const r = await core.getNotificationRows(octokit, notifs, cards, {
		enrichMaxWorkers: 10,
		useCache: false,
	});
	assert.equal(r.length, 2);
	assert.equal(octokit.rest.issues.get.mock.callCount(), 2);
});

// ───────────────────────────────────────────────────────────────────────
// performUnsub / markIssueNotificationDone no-thread branches
// ───────────────────────────────────────────────────────────────────────

test("performUnsub returns no-thread error when nothing matches", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield { data: [] };
				},
			}),
		},
		rest: { activity: { listNotificationsForAuthenticatedUser: () => {} } },
		request: mock.fn(async () => {}),
	};
	const r = await core.performUnsub(octokit, "o/r", "999");
	assert.equal(r.ok, false);
	assert.ok(/thread/i.test(r.error));
	assert.equal(octokit.request.mock.callCount(), 0);
});

test("performUnsub rejects fractional and negative issue numbers", async () => {
	assert.deepEqual(await core.performUnsub({}, "o/r", "1.5"), {
		ok: false,
		error: "Issue number must be a number",
	});
	assert.deepEqual(await core.performUnsub({}, "o/r", "abc"), {
		ok: false,
		error: "Issue number must be a number",
	});
});

test("markIssueNotificationDone returns no-thread error when nothing matches", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield { data: [] };
				},
			}),
		},
		rest: { activity: { listNotificationsForAuthenticatedUser: () => {} } },
		request: mock.fn(async () => {}),
	};
	const r = await core.markIssueNotificationDone(octokit, "o/r", "999");
	assert.equal(r.ok, false);
	assert.ok(/thread/i.test(r.error));
	assert.equal(octokit.request.mock.callCount(), 0);
});

test("markAllNotificationsDone skips rows without ids", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield { data: [{ id: "a" }, { id: null }, {}, { id: "b" }] };
				},
			}),
		},
		rest: { activity: { listNotificationsForAuthenticatedUser: () => {} } },
		request: mock.fn(async () => {}),
	};
	const r = await core.markAllNotificationsDone(octokit);
	assert.equal(r.ok, true);
	assert.equal(r.count, 2);
	// Only "a" and "b" should be deleted — the null and missing-id rows are skipped.
	const threadIds = octokit.request.mock.calls.map(
		(c) => c.arguments[1].thread_id,
	);
	assert.deepEqual(threadIds, ["a", "b"]);
});

// ───────────────────────────────────────────────────────────────────────
// findThreadIdForIssue case insensitivity
// ───────────────────────────────────────────────────────────────────────

test("findThreadIdForIssue matches across repo case differences", async () => {
	const octokit = {
		paginate: {
			iterator: () => ({
				[Symbol.asyncIterator]: async function* () {
					yield {
						data: [
							{
								id: "matched",
								repository: { full_name: "Owner/Repo" },
								subject: { url: "https://api.github.com/repos/Owner/Repo/issues/42" },
							},
						],
					};
				},
			}),
		},
		rest: { activity: { listNotificationsForAuthenticatedUser: () => {} } },
	};
	const tid = await core.findThreadIdForIssue(octokit, "owner/repo", 42);
	assert.equal(tid, "matched");
});

// ───────────────────────────────────────────────────────────────────────
// Notifications constructor
// ───────────────────────────────────────────────────────────────────────

test("Notifications constructor throws when token is missing and not in testMode", async () => {
	const { Notifications } = await import("../scripts/github.js");
	assert.throws(
		() => new Notifications("", { testMode: false }),
		/GitHub token is required/,
	);
});

test("Notifications constructor accepts a real token without crashing", async () => {
	const { Notifications } = await import("../scripts/github.js");
	const n = new Notifications("ghp_anything", { testMode: false, cache: false });
	await n.awaitPromises();
	assert.equal(n.user, "");
	assert.deepEqual(n.notifications, []);
});

test("Notifications testMode handles minimal/sparse fixture", async () => {
	const { Notifications } = await import("../scripts/github.js");
	const fs = await import("node:fs");
	const os = await import("node:os");
	const path = await import("node:path");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-fix-"));
	const fixturePath = path.join(dir, "min.json");
	try {
		fs.writeFileSync(
			fixturePath,
			JSON.stringify({
				usersGetAuthenticated: { data: {} }, // missing login → falls back to ""
				listNotificationsForAuthenticatedUser: [
					{
						id: "row-1",
						// No `repository`, no `subject` — every defensive fallback fires.
					},
					{
						id: "row-2",
						repository: { full_name: "o/r" },
						subject: { url: "https://api.github.com/repos/o/r/issues/9" },
						// no title, no reason, no updated_at, no unread, no labels in issuesGet
					},
				],
				// issuesGet, getAISummaryByIssue missing entirely → fall back to {}
			}),
			"utf8",
		);
		const n = new Notifications("fixture-token", {
			testMode: true,
			cache: false,
			fixturePath,
		});
		await n.awaitPromises();
		assert.equal(n.user, ""); // missing login fell back
		assert.equal(n.notifications.length, 2);
		assert.equal(n.notifications[0].repo_full_name, "");
		assert.equal(n.notifications[0].title, "");
		assert.equal(n.notifications[1].issue_number, "9");
		assert.equal(n.notifications[1].summary, ""); // missing summary entry
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("Notifications testMode normalizes string-only and color-prefixed labels", async () => {
	const { Notifications } = await import("../scripts/github.js");
	const fs = await import("node:fs");
	const os = await import("node:os");
	const path = await import("node:path");
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gh-notif-fix-"));
	const fixturePath = path.join(dir, "labels.json");
	try {
		fs.writeFileSync(
			fixturePath,
			JSON.stringify({
				usersGetAuthenticated: { data: { login: "u" } },
				listNotificationsForAuthenticatedUser: [
					{
						id: "1",
						repository: { full_name: "o/r" },
						subject: { url: "https://api.github.com/repos/o/r/issues/1", title: "T" },
					},
				],
				issuesGet: {
					"o/r#1": {
						data: {
							labels: [
								"plain-string-label",
								{ name: "with-hash", color: "#abc123" },
								{ name: "missing-color" },
							],
						},
					},
				},
			}),
			"utf8",
		);
		const n = new Notifications("t", { testMode: true, cache: false, fixturePath });
		await n.awaitPromises();
		const labels = n.notifications[0].labels;
		assert.equal(labels[0].name, "plain-string-label");
		assert.equal(labels[0].color, "ededed");
		assert.equal(labels[1].name, "with-hash");
		assert.equal(labels[1].color, "abc123"); // # stripped
		assert.equal(labels[2].name, "missing-color");
		assert.equal(labels[2].color, "ededed");
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});
