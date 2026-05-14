import assert from "node:assert/strict";
import { mock } from "node:test";
import test from "node:test";

import * as server from "../scripts/server.js";

/**
 * @param {import("http").IncomingMessage} req
 * @returns {Promise<{ code: number, headers: Record<string, unknown>, body: string }>}
 */
function handleRequest(req) {
	const handler = server.createHandler("<html>ok</html>");
	return new Promise((resolve, reject) => {
		const res = {
			_code: 200,
			_headers: /** @type {Record<string, unknown>} */ ({}),
			writeHead(c, h) {
				this._code = c;
				this._headers = h ?? {};
			},
			end(b) {
				resolve({
					code: this._code,
					headers: this._headers,
					body: typeof b === "string" ? b : Buffer.from(b ?? "").toString("utf8"),
				});
			},
		};
		handler(req, res).catch(reject);
	});
}

test("createHandler GET / returns HTML", async () => {
	const res = await handleRequest({ method: "GET", url: "/" });
	assert.equal(res.code, 200);
	assert.equal(res.headers["Content-Type"], "text/html; charset=utf-8");
	assert.ok(res.body.includes("ok"));
});

test("createHandler GET empty path returns HTML", async () => {
	const res = await handleRequest({ method: "GET", url: "" });
	assert.equal(res.code, 200);
});

test("createHandler GET unknown path returns 404", async () => {
	const res = await handleRequest({ method: "GET", url: "/nope" });
	assert.equal(res.code, 404);
	assert.equal(res.body, "Not found");
});

test("createHandler POST /api/unsub rejects invalid JSON", async () => {
	const req = {
		method: "POST",
		url: "/api/unsub",
		async *[Symbol.asyncIterator]() {
			yield "not-json{";
		},
	};
	const res = await handleRequest(req);
	assert.equal(res.code, 400);
	const j = JSON.parse(res.body);
	assert.equal(j.ok, false);
	assert.ok(String(j.error).includes("Invalid JSON"));
});

test("createHandler POST /api/unsub 400 when repo missing", async () => {
	const req = {
		method: "POST",
		url: "/api/unsub",
		async *[Symbol.asyncIterator]() {
			yield JSON.stringify({ repo: "", issue: "1" });
		},
	};
	const res = await handleRequest(req);
	assert.equal(res.code, 400);
});

test("createHandler POST /api/unsub 400 when issue not numeric", async () => {
	const req = {
		method: "POST",
		url: "/api/unsub",
		async *[Symbol.asyncIterator]() {
			yield JSON.stringify({ repo: "o/r", issue: "x" });
		},
	};
	const res = await handleRequest(req);
	assert.equal(res.code, 400);
});

test("createHandler POST /api/unsub 502 when thread not found", async () => {
	const performUnsub = mock.fn(async () => ({
		ok: false,
		error: "No matching notification thread for this issue",
	}));
	const handler = server.createHandler("<html></html>", {
		createOctokit: () => ({}),
		performUnsub,
	});
	const res = await new Promise((resolve, reject) => {
		const req = {
			method: "POST",
			url: "/api/unsub",
			async *[Symbol.asyncIterator]() {
				yield JSON.stringify({ repo: "o/r", issue: "1" });
			},
		};
		const resStub = {
			_code: 200,
			_headers: {},
			writeHead(c, h) {
				this._code = c;
				this._headers = h ?? {};
			},
			end(b) {
				resolve({
					code: this._code,
					body: typeof b === "string" ? b : String(b),
				});
			},
		};
		handler(req, resStub).catch(reject);
	});
	assert.equal(res.code, 502);
	assert.equal(performUnsub.mock.callCount(), 1);
});

test("createHandler POST /api/unsub 200 when unsub succeeds", async () => {
	const performUnsub = mock.fn(async () => ({ ok: true, error: "" }));
	const handler = server.createHandler("<html></html>", {
		createOctokit: () => ({}),
		performUnsub,
	});
	const res = await new Promise((resolve, reject) => {
		const req = {
			method: "POST",
			url: "/api/unsub",
			async *[Symbol.asyncIterator]() {
				yield JSON.stringify({ repo: "o/r", issue: "1" });
			},
		};
		const resStub = {
			_code: 200,
			writeHead(c, h) {
				this._code = c;
				this._headers = h ?? {};
			},
			end(b) {
				resolve({ code: this._code, body: String(b) });
			},
		};
		handler(req, resStub).catch(reject);
	});
	assert.equal(res.code, 200);
	assert.deepEqual(JSON.parse(res.body), { ok: true });
});

test("createHandler POST /api/unsub 500 when performUnsub throws", async () => {
	const performUnsub = mock.fn(async () => {
		throw new Error("network exploded");
	});
	const handler = server.createHandler("<html></html>", {
		createOctokit: () => ({}),
		performUnsub,
	});
	const res = await new Promise((resolve, reject) => {
		const req = {
			method: "POST",
			url: "/api/unsub",
			async *[Symbol.asyncIterator]() {
				yield JSON.stringify({ repo: "o/r", issue: "1" });
			},
		};
		const resStub = {
			writeHead(c, h) {
				this._code = c;
				this._headers = h ?? {};
			},
			end(b) {
				resolve({ code: this._code, body: String(b) });
			},
		};
		handler(req, resStub).catch(reject);
	});
	assert.equal(res.code, 500);
	const body = JSON.parse(res.body);
	assert.equal(body.ok, false);
	assert.ok(body.error.includes("network exploded"));
});

test("createHandler POST /api/unsub 500 when result is ok:false without 'thread' keyword", async () => {
	const performUnsub = mock.fn(async () => ({
		ok: false,
		error: "permission denied",
	}));
	const handler = server.createHandler("<html></html>", {
		createOctokit: () => ({}),
		performUnsub,
	});
	const res = await new Promise((resolve, reject) => {
		const req = {
			method: "POST",
			url: "/api/unsub",
			async *[Symbol.asyncIterator]() {
				yield JSON.stringify({ repo: "o/r", issue: "1" });
			},
		};
		const resStub = {
			writeHead(c, h) {
				this._code = c;
				this._headers = h ?? {};
			},
			end(b) {
				resolve({ code: this._code, body: String(b) });
			},
		};
		handler(req, resStub).catch(reject);
	});
	assert.equal(res.code, 500);
});

test("createHandler POST with numeric issue field is accepted", async () => {
	const performUnsub = mock.fn(async () => ({ ok: true }));
	const handler = server.createHandler("<html></html>", {
		createOctokit: () => ({}),
		performUnsub,
	});
	const res = await new Promise((resolve, reject) => {
		const req = {
			method: "POST",
			url: "/api/unsub",
			async *[Symbol.asyncIterator]() {
				// Note: issue is a number, not a string. Handler should coerce.
				yield JSON.stringify({ repo: "o/r", issue: 42 });
			},
		};
		const resStub = {
			writeHead(c, h) {
				this._code = c;
				this._headers = h ?? {};
			},
			end(b) {
				resolve({ code: this._code, body: String(b) });
			},
		};
		handler(req, resStub).catch(reject);
	});
	assert.equal(res.code, 200);
	assert.equal(performUnsub.mock.calls[0].arguments[2], "42");
});

test("createHandler accepts real Node IncomingMessage-style request (Buffer chunks)", async () => {
	const performUnsub = mock.fn(async () => ({ ok: true }));
	const handler = server.createHandler("<html></html>", {
		createOctokit: () => ({}),
		performUnsub,
	});
	const res = await new Promise((resolve, reject) => {
		const payload = Buffer.from(JSON.stringify({ repo: "o/r", issue: "1" }));
		const req = {
			method: "POST",
			url: "/api/unsub",
			async *[Symbol.asyncIterator]() {
				yield payload; // Buffer, not string — exercises the toString branch.
			},
		};
		const resStub = {
			writeHead(c, h) {
				this._code = c;
				this._headers = h ?? {};
			},
			end(b) {
				resolve({ code: this._code, body: String(b) });
			},
		};
		handler(req, resStub).catch(reject);
	});
	assert.equal(res.code, 200);
});

test("renderDashboardHtml (rich Nunjucks) emits content for a populated instance", () => {
	const html = server.renderDashboardHtml(
		{
			notifications: [
				{
					thread_id: "t1",
					notif_id: "t1",
					repo_full_name: "o/r",
					issue_number: "42",
					title: "Some title",
					subject_type: "Issue",
					issue_url: "https://api.github.com/repos/o/r/issues/42",
					reason: "mention",
					updated_at: "2024-06-01T15:30:00.000Z",
					unread: true,
					labels: [{ name: "bug", color: "d73a4a" }],
					comments: [],
				},
			],
		},
		["bug"],
	);
	assert.ok(html.includes("Some title"));
	assert.ok(html.includes("o/r"));
	assert.ok(html.includes("mention"));
	// Filters should appear somewhere (the template renders them as buttons).
	assert.ok(html.includes("bug"));
});

test("renderDashboardHtml (rich Nunjucks) handles empty notifications and ignores blank filters", () => {
	const html = server.renderDashboardHtml(
		{ notifications: [] },
		["", "  ", "real-filter"],
	);
	// Should not throw and should emit the document shell + the dashboard script.
	assert.ok(html.includes("<html"));
	assert.ok(html.includes("<head"));
	assert.ok(html.includes("</script>"));
});

test("renderDashboardHtml (rich Nunjucks) handles non-array notifications", () => {
	const html = server.renderDashboardHtml({ notifications: null }, []);
	assert.ok(html.includes("<html"));
});
