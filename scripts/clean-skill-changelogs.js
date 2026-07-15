import { cp, rm } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getSkills } from "./parse-skills.js";
import "colors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const skillsDir = path.join(root, "skills");

// `changeset version` writes a CHANGELOG.md into every versioned workspace,
// including the private `skills/*` members. Only the root `@allons-y/agent-skills`
// is published and only its changelog is customer-facing, so the per-skill files
// must be kept in-sync. This copies the root changelog to them after each version bump — it runs in the
// `version:packages` script (see package.json) so the Version Packages PR never
// carries per-skill changelogs.
async function main() {
	const names = await getSkills((entry) => entry.name);

	await Promise.all(
		names.map((name) =>
			cp(path.join(root, "CHANGELOG.md"), path.join(skillsDir, name, "CHANGELOG.md")).catch(() => null)
		)
	);

	console.log(
		`${"✓".green} removed per-skill CHANGELOG.md from: ${names
			.sort()
			.map((name) => name.magenta)
			.join(", ")}`
	);
}

main()
	.then(() => {
		process.exit(0);
	})
	.catch((err) => {
		console.error(`${"✗".red} Failed to clean skill changelogs: ${err.message}`);
		process.exit(1);
	});
