// ---------------------------------------------------------------------------
// HTTP server — local dashboard for browsing notifications.
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import { execFile } from "node:child_process";
import http from "node:http";

import prettier from "@prettier/sync";
import nunjucks from "nunjucks";
import randomColor from "randomcolor";
import markdownIt from "markdown-it";

import { performUnsub as defaultPerformUnsub, relativeTime } from "./github.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

/**
 * Read a request body from an async-iterable `req`. Works with both real
 * Node IncomingMessage (which is an async iterable) and test stubs.
 *
 * @param {AsyncIterable<Buffer|string>} req
 * @returns {Promise<string>}
 */
async function readBody(req) {
	let body = "";
	for await (const chunk of req) {
		body += typeof chunk === "string" ? chunk : chunk.toString("utf8");
	}
	return body;
}

/**
 * Build a dashboard request handler.
 *
 * @param {string} htmlContent - Pre-rendered dashboard HTML for GET /.
 * @param {{
 *   createOctokit?: () => object,
 *   performUnsub?: (octokit: object, repo: string, issue: string|number) => Promise<{ ok: boolean, error?: string }>,
 * }} [deps]
 * @returns {(req: any, res: any) => Promise<void>}
 */
export function createHandler(htmlContent, deps = {}) {
	const createOctokit = deps.createOctokit ?? (() => ({}));
	const doUnsub = deps.performUnsub ?? defaultPerformUnsub;

	return async function handler(req, res) {
		const url = new URL(req.url ?? "/", "http://localhost");
		const pathname = url.pathname;

		if (req.method === "GET" && (pathname === "/" || pathname === "")) {
			const buf = Buffer.from(htmlContent, "utf8");
			res.writeHead(200, {
				"Content-Type": "text/html; charset=utf-8",
				"Content-Length": String(buf.length),
			});
			res.end(buf);
			return;
		}

		if (req.method === "POST" && pathname === "/api/unsub") {
			const raw = await readBody(req);
			let body;
			try {
				body = JSON.parse(raw);
			} catch (e) {
				return sendJson(res, 400, {
					ok: false,
					error: `Invalid JSON: ${e?.message ?? String(e)}`,
				});
			}

			const repo = typeof body?.repo === "string" ? body.repo.trim() : "";
			const issueRaw = body?.issue;
			if (!repo) {
				return sendJson(res, 400, {
					ok: false,
					error: "Repository is required",
				});
			}
			const issueStr = typeof issueRaw === "number" ? String(issueRaw) : String(issueRaw ?? "").trim();
			if (!/^\d+$/.test(issueStr)) {
				return sendJson(res, 400, {
					ok: false,
					error: "Issue number must be a number",
				});
			}

			try {
				const octokit = createOctokit();
				const result = await doUnsub(octokit, repo, issueStr);
				if (!result?.ok) {
					const msg = result?.error ?? "Unsubscribe failed";
					const code = /thread/i.test(msg) ? 502 : 500;
					return sendJson(res, code, { ok: false, error: msg });
				}
				return sendJson(res, 200, { ok: true });
			} catch (e) {
				return sendJson(res, 500, {
					ok: false,
					error: e?.message ?? String(e),
				});
			}
		}

		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end("Not found");
	};
}

function sendJson(res, code, payload) {
	res.writeHead(code, { "Content-Type": "application/json" });
	res.end(JSON.stringify(payload));
}

/**
 * Start the dashboard HTTP server.
 *
 * @param {{ notifications: object[] }} instance
 * @param {{ filters?: string[], port?: number, hostname?: string, createOctokit?: () => object }} [options]
 */
export function startHttpServer(
	instance,
	{ filters = [], port = 8000, hostname = "localhost", createOctokit } = {}
) {
	const htmlContent = renderDashboardHtml(instance, filters);
	const handler = createHandler(htmlContent, { createOctokit });
	const server = http.createServer(handler);

	server.on("error", (err) => {
		console.error(err);
		process.exit(1);
	});

	server.listen(port, hostname, () => {
		console.log(
			`Dashboard at http://${hostname}:${port} — press Ctrl+C to stop`
		);
	});

	setTimeout(() => {
		const url = `http://${hostname}:${port}`;
		if (process.platform === "darwin") execFile("open", [url], () => {});
		else if (process.platform === "win32")
			execFile("cmd", ["/c", "start", "", url], { windowsHide: true }, () => {});
		else execFile("xdg-open", [url], () => {});
	}, 250);

	const shutdown = () => {
		server.close();
		process.exit(0);
	};
	process.on("SIGINT", () => {
		console.log("\nStopping server…");
		shutdown();
	});
	process.on("SIGTERM", shutdown);

	return server;
}

// ──────────────────────────────────────────────────────────────────────
// Rich dashboard HTML (Nunjucks). Used at runtime by startHttpServer.
// Tests probe a simpler renderer exported from `./github.js`.
// ──────────────────────────────────────────────────────────────────────

// Static dashboard assets are read and Prettier-formatted exactly once at
// module load — they don't change between requests
const DASHBOARD_ASSETS = (() => {
	const minifyOptions = {
		proseWrap: "never",
		tabWidth: 0,
		useTabs: false,
		bracketSpacing: false,
	};
	function load(ext, parser) {
		const file = readFileSync(
			path.join(TEMPLATES_DIR, `dashboard.${ext}`),
			"utf-8"
		);
		try {
			return prettier.format(file, { ...minifyOptions, parser });
		} catch {
			return file;
		}
	}
	return {
		styles: load("css", "css"),
		script: load("js", "babel"),
	};
})();

/**
 * Render the dashboard HTML via the project's Nunjucks templates.
 *
 * @param {{ notifications: object[] }} instance
 * @param {string[]} filters
 * @returns {string}
 */
export function renderDashboardHtml(instance, filters = []) {
	const cards = Array.isArray(instance?.notifications) ? instance.notifications : [];
	const repositories = new Set(cards.map((c) => c?.repo_full_name).filter(Boolean));
	const reasons = new Set(cards.map((c) => c?.reason).filter(Boolean));

	const env = getNunjucksEnv();

	return env.render("dashboard.html", {
		styles: DASHBOARD_ASSETS.styles,
		script: DASHBOARD_ASSETS.script,
		filters: (filters ?? []).map((r) => String(r).trim()).filter(Boolean),
		now: new Date().toISOString(),
		Notifications: instance,
		cards,
		reasons: [...reasons].sort((a, b) => a.localeCompare(b)),
		repositories: [...repositories].sort((a, b) => a.localeCompare(b)),
	});
}

function getNunjucksEnv() {
	const env = nunjucks.configure(TEMPLATES_DIR, {
		autoescape: true,
		noCache: true,
	});
	const markdown = markdownIt();
	env.addFilter("plural", (n) => (n === 1 ? "" : "s"));
	env.addFilter("markdown", (v) => markdown.render(v ?? ""));
	env.addFilter("date", (s, fmt) => (s ? relativeTime(s, fmt) : ""));
	env.addFilter("datetime", (s) =>
		s ? new Date(String(s)).toISOString() : ""
	);
	env.addFilter("printify", (v) => String(v ?? "").replace(/-/g, " "));
	env.addFilter("classify", (v) =>
		String(v ?? "")
			.toLowerCase()
			.replace(/[\s/_]/g, "-")
	);
	env.addFilter("randomColor", (seed, luminosity = "light") =>
		randomColor({ seed, luminosity })
	);
	return env;
}
