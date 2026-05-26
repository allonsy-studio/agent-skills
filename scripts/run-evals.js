import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const skillsDir = "skills";
const root = process.cwd();

// Override with ANTHROPIC_MODEL env var if needed.
// Use || instead of ?? so an empty string (set by GitHub Actions when input is blank) also falls back.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

/**
 * Build a minimal tool definition for runnable entrypoints in the skill.
 * Sources, in order:
 *   - Python scripts in `scripts/` → one tool per `.py` file.
 *   - The gh-notifications.js CLI → `fetch` / `done` / `unsub` subcommands.
 *   - Slash commands in `commands/*.md` → one tool per command, named after
 *     the filename and described by the file's frontmatter `description`.
 * Tool input schemas stay empty — SKILL.md carries the behavioral detail.
 */
function buildTools(skillPath) {
	const scriptsPath = path.join(skillPath, "scripts");
	const commandsPath = path.join(skillPath, "commands");
	const tools = [];

	if (fs.existsSync(scriptsPath)) {
		const files = fs.readdirSync(scriptsPath);

		for (const f of files) {
			if (f.endsWith(".py") && f !== "__init__.py") {
				tools.push({
					name: f.replace(".py", ""),
					description: `Run the ${f} script`,
					input_schema: { type: "object", properties: {} },
				});
			}
		}

		const hasGhNotificationsCli = files.some((f) =>
			/^gh-notifications\.(mjs|js)$/.test(f)
		);
		if (hasGhNotificationsCli) {
			tools.push(
				{
					name: "fetch",
					description:
						"Run gh-notifications fetch — open the local notification dashboard (http://localhost:8000)",
					input_schema: { type: "object", properties: {} },
				},
				{
					name: "done",
					description:
						"Run gh-notifications done — mark one or all GitHub notifications as read/done",
					input_schema: { type: "object", properties: {} },
				},
				{
					name: "unsub",
					description:
						"Run gh-notifications unsub — unsubscribe from an issue thread and mark the notification done",
					input_schema: { type: "object", properties: {} },
				}
			);
		}
	}

	if (fs.existsSync(commandsPath)) {
		for (const f of fs.readdirSync(commandsPath)) {
			if (!f.endsWith(".md")) continue;
			const name = f.replace(/\.md$/, "");
			const body = fs.readFileSync(path.join(commandsPath, f), "utf8");
			const fmMatch = body.match(/^---\s*([\s\S]*?)\s*---/);
			let description = `Invoke the /${name} command`;
			if (fmMatch) {
				const descLine = fmMatch[1].match(/^description:\s*"?([^"\n]+)"?/m);
				if (descLine) description = descLine[1].trim();
			}
			tools.push({
				name,
				description,
				input_schema: { type: "object", properties: {} },
			});
		}
	}

	return tools;
}

async function runEvalItem(item, tools, skillMd, client) {
	const response = await client.messages.create({
		model: MODEL,
		max_tokens: 256,
		system: skillMd,
		messages: [{ role: "user", content: item.prompt }],
		tools,
		tool_choice: { type: "auto" },
	});

	const toolUses = response.content.filter((b) => b.type === "tool_use");
	const called = toolUses.map((t) => t.name);
	const shouldTrigger = item.should_trigger !== false;

	let passed, reason;

	if (!shouldTrigger) {
		passed = toolUses.length === 0;
		reason = passed
			? "correctly did not trigger"
			: `expected no tool call, got: ${called.join(", ")}`;
	} else if (item.expected_tool_call) {
		passed = called.includes(item.expected_tool_call);
		reason = passed
			? `correctly called ${item.expected_tool_call}`
			: `expected ${item.expected_tool_call}, got: ${called.join(", ") || "no tool call"}`;
	} else {
		passed = toolUses.length > 0;
		reason = passed
			? "triggered a tool call"
			: "expected a tool call but none was made";
	}

	return { id: item.id, passed, reason, prompt: item.prompt };
}

async function runSkillEvals(skillName, client) {
	const skillPath = path.resolve(root, skillsDir, skillName);
	const evalsPath = path.join(skillPath, "evals", "evals.json");

	if (!fs.existsSync(evalsPath)) return null;

	const { evals } = JSON.parse(fs.readFileSync(evalsPath, "utf8"));
	const skillMd = fs.readFileSync(path.join(skillPath, "SKILL.md"), "utf8");
	const tools = buildTools(skillPath);

	console.log(`\nRunning evals for ${skillName} (${evals.length} cases)...`);

	// Run all evals for this skill in parallel.
	const results = await Promise.allSettled(
		evals.map((item) => runEvalItem(item, tools, skillMd, client))
	);

	let failures = 0;
	for (const result of results) {
		if (result.status === "rejected") {
			console.error(
				`  [ERROR] ${result.reason?.message ?? result.reason}`
			);
			failures++;
		} else {
			const { id, passed, reason, prompt } = result.value;
			const truncated =
				prompt.length > 60 ? `${prompt.slice(0, 60)}…` : prompt;
			console.log(`  ${passed ? "✓" : "✗"} [${id}] ${truncated}`);
			if (!passed) {
				console.error(`        → ${reason}`);
				failures++;
			}
		}
	}

	return { skillName, total: evals.length, failures };
}

async function main() {
	if (!process.env.ANTHROPIC_API_KEY) {
		console.error(
			"Error: ANTHROPIC_API_KEY is not set. Export it before running evals."
		);
		process.exit(1);
	}

	if (!fs.existsSync(skillsDir)) {
		console.error(`Directory ${skillsDir} not found.`);
		process.exit(1);
	}

	// Optional: `yarn evals <skill-name>` to target a single skill.
	const targeted = process.argv[2];

	const skillDirs = targeted
		? [targeted]
		: fs
				.readdirSync(skillsDir, { withFileTypes: true })
				.filter((e) => e.isDirectory())
				.map((e) => e.name);

	if (targeted && !fs.existsSync(path.join(skillsDir, targeted))) {
		console.error(`Skill "${targeted}" not found in ${skillsDir}/.`);
		process.exit(1);
	}

	const client = new Anthropic();

	// Run all skills in parallel.
	const summaries = await Promise.allSettled(
		skillDirs.map((name) => runSkillEvals(name, client))
	);

	console.log("\n--- Eval Summary ---");
	let totalFailures = 0;

	for (const s of summaries) {
		if (s.status === "rejected") {
			console.error(`ERROR: ${s.reason?.message ?? s.reason}`);
			totalFailures++;
		} else if (s.value) {
			const { skillName, total, failures } = s.value;
			const passed = total - failures;
			console.log(
				`${failures === 0 ? "✓" : "✗"} ${skillName}: ${passed}/${total} passed`
			);
			totalFailures += failures;
		}
	}

	if (totalFailures > 0) {
		process.exit(1);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
