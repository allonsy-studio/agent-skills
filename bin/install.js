#!/usr/bin/env node
/**
 * @allons-y/agent-skills installer
 *
 * Vendor skills into any agent harness's skill directory. For Claude Code
 * users, the recommended install path is `/plugin marketplace add` against
 * this repo; this CLI is for non-Claude-Code agents (Cursor, OpenCode, Aider,
 * custom SDK harnesses) and offline installs.
 *
 * Usage:
 *   npx @allons-y/agent-skills                         List available skills
 *   npx @allons-y/agent-skills <skill-name>            Install a specific skill
 *   npx @allons-y/agent-skills --all                   Install all skills
 *   npx @allons-y/agent-skills <skill-name> --dir <p>  Install to a custom path
 */

import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";
import "colors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.resolve(__dirname, "..", "skills");
const defaultInstallDir = path.join(os.homedir(), ".claude", "skills");

// Directories and files excluded from vendored installs — dev-only artifacts
// that don't belong in a runtime skill payload.
const EXCLUDED_ENTRIES = new Set([
	"tests",
	"evals",
	"node_modules",
	"coverage",
	".nyc_output",
	".cache",
]);

/**
 * Parse YAML frontmatter from a SKILL.md file. Supports `key: value` pairs
 * plus YAML block scalars (`>` folded, `|` literal).
 */
function parseSkillMeta(skillName) {
	const mdPath = path.join(skillsDir, skillName, "SKILL.md");
	if (!fs.existsSync(mdPath)) return { name: skillName, description: "" };

	const content = fs.readFileSync(mdPath, "utf-8");
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return { name: skillName, description: "" };

	const lines = match[1].split("\n");
	const meta = {};
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i].match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
		if (!m) continue;
		const key = m[1];
		const inline = m[2];
		const block = inline.match(/^([>|])[+-]?\s*$/);
		if (block) {
			const folded = block[1] === ">";
			const collected = [];
			let j = i + 1;
			while (j < lines.length) {
				const next = lines[j];
				if (next.trim() === "") {
					collected.push("");
					j++;
					continue;
				}
				if (!/^\s+/.test(next)) break;
				collected.push(next.trim());
				j++;
			}
			i = j - 1;
			const trimmed = collected.filter(
				(_, idx, arr) => !(idx === arr.length - 1 && arr[idx] === "")
			);
			meta[key] = folded
				? trimmed.join(" ").replace(/\s+/g, " ").trim()
				: trimmed.join("\n");
		} else {
			meta[key] = inline.trim().replace(/^["']|["']$/g, "");
		}
	}

	return {
		name: meta.name || skillName,
		description: meta.description || "",
	};
}

/**
 * List available skills and their descriptions.
 */
function listSkills() {
	if (!fs.existsSync(skillsDir)) {
		console.log(
			"✗".red +
				"  No skills directory found. The package may not have been published yet."
		);
		process.exit(1);
	}

	const skills = fs
		.readdirSync(skillsDir, { withFileTypes: true })
		.filter((e) => e.isDirectory())
		.map((e) => parseSkillMeta(e.name));

	if (skills.length === 0) {
		console.log("!".yellow + "  No skills found.");
		return;
	}

	console.log(`\n${"Available skills".bold} (${skills.length} total)\n`);
	for (const skill of skills) {
		console.log(`  ${skill.name.cyan}`);
		if (skill.description) {
			const words = skill.description.split(" ");
			const lines = [];
			let line = "";
			for (const word of words) {
				if (line.length + word.length > 76) {
					lines.push(line.trimEnd());
					line = word + " ";
				} else {
					line += word + " ";
				}
			}
			if (line.trim()) lines.push(line.trimEnd());
			console.log(`    ${lines.join("\n    ")}`.dim);
		}
		console.log();
	}

	console.log(
		`${"Install a skill:".dim}  npx @allons-y/agent-skills <skill-name>`
	);
	console.log(
		`${"Install all:".dim}      npx @allons-y/agent-skills --all\n`
	);
	console.log(
		`${"Using Claude Code? Prefer:".dim}  /plugin marketplace add castastrophe/agent-skills\n`
	);
}

/**
 * Install a single skill by name. Copies the skill directory to the install
 * path, excluding dev-only artifacts. If a legacy `.zip` is present beside the
 * skill, logs a deprecation notice and extracts it instead.
 */
function installSkill(skillName, installDir) {
	const srcPath = path.join(skillsDir, skillName);
	const zipPath = path.join(skillsDir, `${skillName}.zip`);
	const destPath = path.join(installDir, skillName);

	if (fs.existsSync(zipPath)) {
		console.log(
			"⚠".yellow +
				"  Zip-based distribution is deprecated and will be removed in the next major version."
		);
		console.log(
			"   ".dim +
				"Skills are now copied directly from the package source."
		);
		fs.mkdirSync(destPath, { recursive: true });
		const zip = new AdmZip(zipPath);
		zip.extractAllTo(destPath, true);
	} else if (fs.existsSync(srcPath)) {
		copyDir(srcPath, destPath);
	} else {
		console.log(
			"✗".red +
				`  Skill "${skillName}" not found. Run without arguments to list available skills.`
		);
		process.exit(1);
	}

	const meta = parseSkillMeta(skillName);
	console.log("✓".green + `  Installed ${meta.name.bold} → ${destPath.dim}`);
}

/**
 * Recursively copy a directory, skipping dev-only artifacts.
 */
function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		if (EXCLUDED_ENTRIES.has(entry.name)) continue;
		const srcEntry = path.join(src, entry.name);
		const destEntry = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDir(srcEntry, destEntry);
		} else {
			fs.copyFileSync(srcEntry, destEntry);
		}
	}
}

function main() {
	const args = process.argv.slice(2);
	const installAll = args.includes("--all");
	const dirFlag = args.indexOf("--dir");
	const installDir = dirFlag !== -1 ? args[dirFlag + 1] : defaultInstallDir;
	const skillArg = args.find((a) => !a.startsWith("--"));

	if (!skillArg && !installAll) {
		listSkills();
		return;
	}

	if (!fs.existsSync(installDir)) {
		fs.mkdirSync(installDir, { recursive: true });
		console.log("→".cyan + `  Created install directory: ${installDir}`);
	}

	if (installAll) {
		const skills = fs
			.readdirSync(skillsDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name);

		console.log(
			`\nInstalling ${skills.length} skill(s) to ${installDir.dim}\n`
		);
		for (const skill of skills) {
			installSkill(skill, installDir);
		}
		console.log(`\n${"Done!".green.bold}\n`);
	} else {
		console.log();
		installSkill(skillArg, installDir);
		console.log(`\n${"Done!".green.bold}\n`);
	}
}

main();
