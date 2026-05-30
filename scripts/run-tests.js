import fs from "fs";
import path from "path";
import { execa } from "execa";
import { Listr } from "listr2";
import table from "text-table";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import "colors";

/* eslint-disable no-control-regex */
/* prettier-ignore no-control-regex */

const root = process.cwd();
const skills = fs.existsSync(path.join(root, "skills"))
	? (fs
			.readdirSync(path.join(root, "skills"), { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name) ?? [])
	: [];
const argv = yargs()
	.usage("$0 [skills...]", "run test suite for the given skills", (yargs) => {
		return yargs
			.positional("skills", {
				type: "array",
				of: "string",
				optional: true,
				choices: skills,
				default: skills,
				description: "the names of the skills to run the tests for",
			})
			.options({
				coverageOnly: {
					type: "boolean",
					description: "only run coverage reports",
					default: false,
				},
			});
	})
	.help()
	.parseSync(hideBin(process.argv));

/**
 * @typedef {Object} TestFailure
 * @property {string} nodeid
 * @property {string} message
 */

/**
 * @typedef {Object} ReportLog
 * @property {number} total
 * @property {number} passed
 * @property {number} failed
 * @property {number} time
 * @property {TestFailure[]} failures
 */

/**
 * Parse `node --test` spec reporter summary lines from combined stdout/stderr.
 *
 * @param {string} text
 * @returns {ReportLog}
 */
function parseNodeTestOutput(text) {
	const s = stripAnsi(text || "");
	const testsM = s.match(/ℹ tests (\d+)/);
	const passM = s.match(/ℹ pass (\d+)/);
	const failM = s.match(/ℹ fail (\d+)/);
	const durM = s.match(/ℹ duration_ms ([\d.]+)/);
	const total = testsM ? parseInt(testsM[1], 10) : 0;
	const passed = passM ? parseInt(passM[1], 10) : 0;
	const failed = failM ? parseInt(failM[1], 10) : 0;
	const time = durM ? parseFloat(durM[1]) / 1000 : 0;
	const failures = [];
	if (failed > 0) {
		const failBlock = s.split(/failing tests?:/i)[1];
		if (failBlock) {
			const chunks = failBlock.split(/\n(?=test at |\n✖)/);
			for (const chunk of chunks) {
				const nameM = chunk.match(/✖\s+([^\n]+)/);
				const msgM = chunk.match(
					/AssertionError[^\n]*\n\s*([\s\S]*?)(?=\n\s*at |\n\n|$)/
				);
				if (nameM) {
					failures.push({
						nodeid: nameM[1].trim(),
						message:
							(msgM && msgM[1] ? msgM[1] : chunk)
								.split("\n")
								.map((l) => l.trim())
								.filter(Boolean)[0] || "failed",
					});
				}
			}
		}
	}
	return { total, passed, failed, time, failures };
}

/**
 * Parse a c8 coverage-summary.json file.
 *
 * @param {import("fs").PathLike} reportPath
 * @returns {{ totals: { percent_covered: number }, files: { name: string, rate: number, uncoveredLines: string[] }[] } | void}
 */
function parseCoverageSummary(reportPath) {
	if (!fs.existsSync(reportPath)) return;
	const data = JSON.parse(fs.readFileSync(reportPath, "utf8"));
	const total = data.total?.lines?.pct;
	const files = Object.entries(data)
		.filter(([k]) => k !== "total")
		.map(([file, entry]) => ({
			name: path.basename(file),
			rate: entry?.lines?.pct ?? 0,
			uncoveredLines: [],
		}));
	return {
		totals: { percent_covered: total ?? 0 },
		files,
	};
}

/**
 * @param {number|void} c
 * @returns {string}
 */
const printCoverage = (c) =>
	typeof c === "number"
		? `${c > 80 ? String(Math.round(c)).green : String(Math.round(c)).yellow}%`
		: `—`.dim;

const printFailCount = (f, t) => (f > 0 && t > 0 ? String(f).red : String(f));
const printPassed = (p, t) => (p > 0 && t > 0 ? String(p).green : String(p));
const printTime = (t) =>
	typeof t === "number"
		? t > 0 && t.toFixed(2) === "0.00"
			? `>0.01s`
			: `${t.toFixed(2)}s`
		: "";

const stripAnsi = (s) =>
	typeof s === "string" ? s.replace(/\x1B\[\d+m/g, "") : s;

const addTableBorders = (table) => {
	const lines = table
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	const lineWidth = lines
		.map((l) => stripAnsi(l).length)
		.reduce((a, b) => Math.max(a, b), 0);
	const rule = "─".dim.repeat(lineWidth);
	return [rule + "\n", ...lines.map((l) => l + "\n" + rule)];
};

const SUPPORTED_RUNTIMES = new Set(["node"]);

/**
 * Read a skill's declared runtime from its package.json. Returns null if the
 * skill has no package.json (e.g. work-in-progress stubs).
 */
function readSkillRuntime(skillName) {
	const pkgPath = path.join(root, "skills", skillName, "package.json");
	if (!fs.existsSync(pkgPath)) return null;
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
	const runtime = pkg?.skill?.runtime;
	if (!runtime) {
		throw new Error(
			`Skill "${skillName}" is missing required field \`skill.runtime\` in its package.json.`
		);
	}
	if (!SUPPORTED_RUNTIMES.has(runtime)) {
		throw new Error(
			`Skill "${skillName}" declares unsupported runtime "${runtime}". Supported: ${[...SUPPORTED_RUNTIMES].join(", ")}.`
		);
	}
	return runtime;
}

/**
 * Run the tests for a given skill.
 */
async function runSkillTests(skillName, ctx) {
	if (!fs.existsSync(path.join(root, "reports"))) {
		fs.mkdirSync(path.join(root, "reports"), { recursive: true });
	}

	const runtime = readSkillRuntime(skillName);
	if (runtime === null) {
		return {
			failed: false,
			output: `(skipped: ${skillName} has no package.json)\n`,
			report: { total: 0, passed: 0, failed: 0, time: 0, failures: [] },
			coverage: undefined,
		};
	}

	let output = "\n\n";

	// Invoke `coverage` (which wraps `test` with c8) rather than `test`
	// directly, so each skill writes coverage/coverage-summary.json — that's
	// what `parseCoverageSummary` reads below to populate the summary table.
	const result = await execa(
		"yarn",
		["workspace", `@allons-y/skill-${skillName}`, "coverage"],
		{ reject: false, all: true, cwd: root, env: process.env }
	).catch((err) => {
		if (err?.message) output += `${err?.message ?? err}\n\n`;
	});

	if (result?.all || result?.stdout) {
		output += `${result.all || result.stdout}\n\n`;
	}

	const report = parseNodeTestOutput(result?.all || result?.stdout || "");
	const coverage = parseCoverageSummary(ctx.coverageReport(skillName));

	return {
		failed: result?.exitCode !== 0,
		output,
		report,
		coverage,
	};
}

function printSummaryTable(results) {
	const rows = Object.entries(results).filter(([, data]) => data.report);
	if (rows.length === 0) return;

	const headers = ["Skill", "Tests", "Passed", "Failed", "Time", "Coverage"];
	let totalTests = 0;
	let totalPassed = 0;
	let totalFailed = 0;
	let totalCoverage = 0;
	let totalTime = 0;

	let coverageSkillCount = 0;
	const dataRows = rows.map(([skillName, data]) => {
		const { total, passed, failed, time } = data.report || {};
		totalTests += total;
		totalPassed += passed;
		totalFailed += failed;
		const pct = data.coverage?.totals?.percent_covered;
		if (typeof pct === "number") {
			totalCoverage += pct;
			coverageSkillCount += 1;
		}
		totalTime += time;
		return [
			skillName.magenta,
			String(total),
			printPassed(passed, total),
			printFailCount(failed, total),
			printTime(time),
			printCoverage(typeof pct === "number" ? pct : undefined),
		];
	});

	const footerRow = [
		"Total".bold,
		String(totalTests),
		printPassed(totalPassed, totalTests),
		printFailCount(totalFailed, totalTests),
		printTime(totalTime),
		printCoverage(
			coverageSkillCount > 0
				? totalCoverage / coverageSkillCount
				: undefined
		),
	];

	const output = table([headers.map((h) => h.bold), ...dataRows, footerRow], {
		align: ["l", "c", "c", "c", "r", "r"],
		stringLength: (s) => stripAnsi(s).length,
	});

	const resultLines = [];
	resultLines.push(...addTableBorders(output));

	const allFailures = rows.flatMap(([, data]) =>
		(data.report?.failures || []).map((f) => ({ ...f }))
	);
	if (allFailures.length > 0) {
		resultLines.push("\n\nFailed tests:");
		for (const f of allFailures) {
			resultLines.push(`  ${"✗".red}  ${f.nodeid}`);
			resultLines.push(`     ${f.message}`);
		}
	}

	resultLines.push();
	return resultLines.join("\n");
}

async function main() {
	const tasks = new Listr(
		[
			{
				title: "Run tests",
				task: async (ctx, task) => {
					ctx.results = {};
					return task.newListr(
						ctx.skills.map((name) => ({
							title: `${name.magenta}`,
							task: async (ctx) => {
								return runSkillTests(name, ctx).then(
									(result) => {
										ctx.results[name] = result;
										return result;
									}
								);
							},
						})),
						{ concurrent: true }
					);
				},
			},
			{
				title: "Print summary table",
				enabled: (ctx) => !ctx.coverageOnly,
				task: async (ctx, task) => {
					if (Object.keys(ctx.results).length === 0) {
						throw new Error(`No test results collected.\n`);
					}

					for (const [skillName, data] of Object.entries(
						ctx.results
					)) {
						if (!data.failed) continue;
						if (data.output && data.output.length > 0) {
							task.output = `\n\n${data.output}\n\n`;
						} else {
							task.output = `\n${"✗".red}  ${skillName}  —  (no output captured)\n`;
						}
					}

					task.output = `${" Test summary ".bold.bgWhite.black}\n\n${printSummaryTable(ctx.results)}\n\n`;

					if (Object.values(ctx.results).some((d) => d.failed)) {
						throw new Error(
							`Some tests failed. See output for details.\n`
						);
					}
				},
				rendererOptions: {
					bottomBar: Infinity,
					persistentOutput: true,
				},
			},
			{
				title: "Print coverage report",
				task: async (ctx, task) => {
					const rows = [];

					Object.entries(ctx.results).forEach(([skillName, data]) => {
						const pct = data.coverage?.totals?.percent_covered;
						rows.push([
							skillName.magenta,
							printCoverage(
								typeof pct === "number" ? pct : undefined
							),
							"",
						]);
						data.coverage?.files?.forEach((f) => {
							rows.push([
								` - ${f.name.cyan}`,
								printCoverage(f.rate),
								f.uncoveredLines.join(", "),
							]);
						});
					});

					const coverageTable = table(
						[
							[
								"Test".bold,
								"Line rate".bold,
								"Uncovered Lines".bold,
							],
							...rows,
						],
						{
							stringLength: (s) => stripAnsi(s).length,
							align: ["l", "c", "l"],
						}
					);
					task.output = `\n\n${" Coverage report ".bold.bgWhite.black}\n${addTableBorders(coverageTable).join("\n")}\n\n`;
				},
				rendererOptions: {
					bottomBar: Infinity,
					persistentOutput: true,
				},
			},
		],
		{
			concurrent: false,
			ctx: {
				skillDirectory: (skillName) =>
					path.join(root, "skills", skillName),
				testDirectory: (skillName) =>
					path.join(root, "skills", skillName, "tests"),
				scriptsDirectory: (skillName) =>
					path.join(root, "skills", skillName, "scripts"),
				coverageReport: (skillName) =>
					path.join(
						root,
						"skills",
						skillName,
						"coverage",
						"coverage-summary.json"
					),
				...argv,
			},
		}
	);

	return await tasks
		.run()
		.catch((e) => Promise.reject(new Error(e?.message ?? e)));
}

main().catch((err) => {
	console.error(err?.message ?? err);
	process.exit(1);
});

/* eslint-enable no-control-regex */
/* prettier-enable no-control-regex */
