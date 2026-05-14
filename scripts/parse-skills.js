import fs from "fs";
import { readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import "colors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const skillsDir = path.join(root, "skills");

/**
 * Parse the YAML frontmatter from a SKILL.md file.
 *
 * Supports simple `key: value` pairs plus block scalars (`>` folded and `|`
 * literal). For block scalars, all subsequent lines indented deeper than the
 * key are collected; folded scalars join with spaces, literal scalars join
 * with newlines.
 *
 * Returns an object with the frontmatter key/value pairs.
 */
export function parseFrontmatter(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return {};

	const lines = match[1].split("\n");
	const result = {};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
		if (!m) continue;

		const key = m[1];
		const inlineValue = m[2];
		const blockIndicator = inlineValue.match(/^([>|])[+-]?\s*$/);

		if (blockIndicator) {
			const folded = blockIndicator[1] === ">";
			const collected = [];
			let j = i + 1;
			while (j < lines.length) {
				const next = lines[j];
				if (next.trim() === "") {
					collected.push("");
					j++;
					continue;
				}
				const indent = next.match(/^(\s+)/);
				if (!indent) break;
				collected.push(next.trim());
				j++;
			}
			i = j - 1;
			const trimmed = collected.filter(
				(_, idx, arr) => !(idx === arr.length - 1 && arr[idx] === "")
			);
			result[key] = folded
				? trimmed.join(" ").replace(/\s+/g, " ").trim()
				: trimmed.join("\n");
		} else {
			result[key] = inlineValue.trim().replace(/^["']|["']$/g, "");
		}
	}

	return result;
}

/**
 * Read all skill directories and return their names and metadata.
 * @param {Function} callback - A callback function to process each skill directory.
 * @returns {Promise<any[]>}
 */
export async function getSkills(callback = (entry) => entry) {
	if (!fs.existsSync(skillsDir)) return Promise.resolve([]);

	const skillDirectories = await readdir(skillsDir, { withFileTypes: true })
		.then((entries) => entries.filter((entry) => entry.isDirectory()))
		.catch((err) =>
			Promise.reject(
				new Error(
					`Failed to read ${path.relative(root, skillsDir).cyan}: ${err.message}`
				)
			)
		);

	return Promise.all(skillDirectories.map(callback)).catch((err) =>
		Promise.reject(new Error(`Failed to get skills: ${err.message}`))
	);
}
