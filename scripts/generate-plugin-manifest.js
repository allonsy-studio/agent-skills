import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { parseFrontmatter, getSkills } from "./parse-skills.js";
import "colors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const skillsDir = path.join(root, "skills");

/**
 * Process a skill directory and return its ID, name, description, and path.
 * @param {import("fs").Dirent} entry
 * @returns {Promise<{id: string, name: string, description: string, path: string}>}
 */
async function processSkill(entry) {
	const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
	if (fs.existsSync(skillMdPath)) {
		const content = await readFile(skillMdPath, "utf-8")
			.then((content) => parseFrontmatter(content))
			.catch((err) =>
				Promise.reject(
					new Error(
						`Failed to read ${skillMdPath.cyan}: ${err.message}`
					)
				)
			);

		return Promise.resolve({
			id: entry.name,
			name: content.name || entry.name,
			description: content.description || "",
			path: entry.name,
		});
	}

	return Promise.resolve({
		id: entry.name,
		name: entry.name,
		description: "",
		path: entry.name,
	});
}

async function main() {
	const pkg = await readFile(path.join(root, "package.json"), "utf-8").then(
		(content) => JSON.parse(content)
	);
	if (!pkg) {
		return Promise.reject(
			new Error(
				`Failed to read package.json in ${path.relative(root, "package.json").cyan}`
			)
		);
	}

	const skills = await getSkills(processSkill)
		.then((skills) => skills.sort((a, b) => a.id.localeCompare(b.id)))
		.catch((err) =>
			Promise.reject(new Error(`Failed to get skills: ${err.message}`))
		);

	// ── .claude-plugin/plugin.json ─────────────────────────────────────────
	// Defines this repo as a Claude Code plugin. Lists every skill bundled
	// in the package under components.skills.
	const pluginJson = {
		name: "agent-skills",
		display_name: pkg.name,
		description: pkg.description,
		version: pkg.version,
		components: {
			skills: skills.map((s) => s.path),
		},
	};

	const pluginDir = path.join(root, ".claude-plugin");
	if (!fs.existsSync(pluginDir)) {
		fs.mkdirSync(pluginDir, { recursive: true });
	}

	// ── .claude-plugin/marketplace.json ────────────────────────────────────
	// Defines the marketplace catalog Claude Code reads via
	// `/plugin marketplace add`. One entry per skill — users enable each
	// individually through the `/plugin` UI.
	const marketplaceJson = {
		name: "agent-skills",
		display_name: pkg.name,
		plugins: skills.map((skill) => ({
			id: skill.id,
			name: skill.name,
			description: skill.description,
			components: {
				skills: [skill.path],
			},
		})),
	};

	return Promise.all([
		writeFile(
			path.join(pluginDir, "plugin.json"),
			JSON.stringify(pluginJson, null, 2) + "\n",
			"utf-8"
		)
			.then(() => {
				console.log(
					`${"✓".green} ${".claude-plugin/plugin.json".cyan} generated with: ${skills.map((s) => s.id.magenta).join(", ")}`
				);
			})
			.catch((err) =>
				Promise.reject(
					new Error(
						`Failed to write ${".claude-plugin/plugin.json".cyan}: ${err.message}`
					)
				)
			),
		writeFile(
			path.join(pluginDir, "marketplace.json"),
			JSON.stringify(marketplaceJson, null, 2) + "\n",
			"utf-8"
		)
			.then(() => {
				console.log(
					`${"✓".green} ${".claude-plugin/marketplace.json".cyan} generated with: ${skills.map((s) => s.id.magenta).join(", ")}`
				);
			})
			.catch((err) =>
				Promise.reject(
					new Error(
						`Failed to write ${".claude-plugin/marketplace.json".cyan}: ${err.message}`
					)
				)
			),
	])
		.then(() => Promise.resolve(skills))
		.catch((err) =>
			Promise.reject(
				new Error(`Failed to generate plugin manifest: ${err.message}`)
			)
		);
}

main()
	.then(() => {
		process.exit(0);
	})
	.catch((err) => {
		console.error(`${"✗".red} ${err.message}`);
		process.exit(1);
	});
