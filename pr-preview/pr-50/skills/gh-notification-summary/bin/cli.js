#!/usr/bin/env node
/**
 * Manage GitHub notifications: dashboard, mark-done, unsubscribe.
 *
 *   gh-notifications fetch [--repo OWNER/REPO]
 *   gh-notifications done [<issue>] --repo OWNER/REPO
 *   gh-notifications unsub <issue>  --repo OWNER/REPO
 *
 * Requires GITHUB_TOKEN in the environment or skills/gh-notification-summary/.env.
 * --repo can be supplied via the GITHUB_REPO env var.
 */

import "colors";
import dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { Octokit } from "@octokit/rest";

import {
	getNotificationRows,
	markAllNotificationsDone,
	markIssueNotificationDone,
	performUnsub,
} from "../scripts/github.js";
import { getCache } from "../scripts/caching.js";
import { startHttpServer } from "../scripts/server.js";

dotenv.config();

/**
 * Build an authenticated Octokit instance.
 *
 * @param {string} token
 * @returns {object}
 */
function createOctokit(token) {
	return new Octokit({ auth: token });
}

function err(msg) {
	process.stderr.write(`${"✗".red} ${msg}\n`);
}

function info(msg) {
	process.stdout.write(`${"ℹ".cyan} ${msg}\n`);
}

const cli = yargs(hideBin(process.argv))
	.scriptName("gh-notifications")
	.usage("$0 <command> [options]")
	.env("GITHUB")
	.options({
		token: {
			type: "string",
			default: process.env.GITHUB_TOKEN,
			demandOption: "GitHub token is required (set GITHUB_TOKEN or pass --token)",
			alias: "t",
			describe: "GitHub token (default: GITHUB_TOKEN env)",
			global: true,
		},
		repo: {
			type: "string",
			default: process.env.GITHUB_REPO,
			alias: "r",
			describe: "Repository in owner/repo form (default: GITHUB_REPO env)",
			global: true,
		},
		cache: {
			type: "boolean",
			default: true,
			alias: "c",
			describe: "Use the enrichment cache",
			global: true,
		},
		verbose: {
			type: "boolean",
			default: false,
			alias: "v",
			describe: "Verbose output",
			global: true,
		},
	})
	.command(
		"fetch",
		"Open the notification dashboard in a browser",
		(y) =>
			y.options({
				port: { type: "number", default: 8000 },
				hostname: { type: "string", default: "localhost" },
				filters: { type: "array", default: [] },
			}),
		async (argv) => {
			const octokit = createOctokit(argv.token);
			const cache = argv.cache ? getCache() : null;

			info("Fetching notifications…");
			const { data: rows } = await octokit.rest.activity
				.listNotificationsForAuthenticatedUser({ all: false, per_page: 100 })
				.catch((e) => {
					err(`Failed to list notifications: ${e?.message ?? e}`);
					process.exit(1);
				});

			const filtered = argv.repo
				? rows.filter(
						(r) =>
							String(r?.repository?.full_name ?? "").toLowerCase() ===
							String(argv.repo).toLowerCase()
					)
				: rows;

			const cards = filtered.map((row) => ({
				thread_id: row.id,
				notif_id: row.id,
				repo_full_name: row?.repository?.full_name ?? "",
				issue_number: String(row?.subject?.url ?? "").split("/").pop() ?? "",
				title: row?.subject?.title ?? "",
				subject_type: row?.subject?.type ?? "",
				issue_url: row?.subject?.url ?? "",
				reason: row?.reason ?? "",
				updated_at: row?.updated_at ?? "",
				unread: row?.unread ?? false,
				labels: [],
				comments: [],
			}));

			info(`Enriching ${cards.length} notifications…`);
			await getNotificationRows(octokit, filtered, cards, {
				cache,
				useCache: !!cache,
				enrichMaxWorkers: 4,
				onEnrichProgress: ({ ref, cached }) =>
					argv.verbose && info(`${cached ? "cached" : "fetched"}: ${ref}`),
			});

			startHttpServer(
				{ notifications: cards },
				{
					port: argv.port,
					hostname: argv.hostname,
					filters: argv.filters,
					createOctokit: () => octokit,
				}
			);
		}
	)
	.command(
		"done [issue]",
		"Mark a notification as done (omit issue for all unread)",
		(y) =>
			y.positional("issue", {
				type: "string",
				describe: "Issue number",
			}),
		async (argv) => {
			const octokit = createOctokit(argv.token);

			if (argv.issue !== undefined) {
				if (!/^\d+$/.test(String(argv.issue))) {
					err("Issue number must be a number");
					process.exit(1);
				}
				if (!argv.repo) {
					err("Repository is required (--repo or GITHUB_REPO)");
					process.exit(1);
				}
				const r = await markIssueNotificationDone(octokit, argv.repo, argv.issue);
				if (!r.ok) {
					err(r.error ?? "Failed to mark notification done");
					process.exit(1);
				}
				info(`Notification ${argv.repo}#${argv.issue} marked as done.`);
				return;
			}

			const r = await markAllNotificationsDone(octokit);
			if (!r.ok) {
				err("Failed to mark all notifications as done");
				process.exit(1);
			}
			info(`Marked ${r.count} notification(s) as done.`);
		}
	)
	.command(
		"unsub <issue>",
		"Unsubscribe from a notification thread",
		(y) =>
			y.positional("issue", {
				type: "string",
				demandOption: true,
				describe: "Issue number",
			}),
		async (argv) => {
			if (!/^\d+$/.test(String(argv.issue))) {
				err("Issue number must be a number");
				process.exit(1);
			}
			if (!argv.repo) {
				err("Repository is required (--repo or GITHUB_REPO)");
				process.exit(1);
			}
			const octokit = createOctokit(argv.token);
			const r = await performUnsub(octokit, argv.repo, argv.issue);
			if (!r.ok) {
				err(r.error ?? "Unsubscribe failed");
				process.exit(1);
			}
			info(`Unsubscribed from ${argv.repo}#${argv.issue}.`);
		}
	)
	.demandCommand(1, "Please choose a command: fetch, done, unsub")
	.strict()
	.help();

cli.parseAsync().catch((e) => {
	err(String(e?.message ?? e));
	process.exit(1);
});
