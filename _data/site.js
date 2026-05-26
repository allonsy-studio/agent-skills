import fs from "node:fs/promises";
import path from "node:path";

/** @type {import('@11ty/eleventy/TemplateConfig').TemplateConfig} */
export default async function (configData) {
	const rootDir = path.resolve(configData.eleventy.env.root);

	const packageJson = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
	const pkg = JSON.parse(packageJson);
	const repoUrl = pkg?.repository?.url?.replace(/\.?git\+?/g, "");
	const repoSegments = repoUrl.replace(/^https?:\/\/[^/]+\//, "").split("/");
	const repoOwner = repoSegments[0];
	const repoName = repoSegments[1];
	const repoSlug = `${repoOwner}/${repoName}`;

	const marketplaceJson = await fs
		.readFile(path.join(rootDir, ".claude-plugin", "marketplace.json"), "utf-8")
		.catch(() => null);
	const marketplaceName = marketplaceJson ? JSON.parse(marketplaceJson).name : repoName;

	const skillsDirs = await fs.readdir(path.join(rootDir, "skills"), { withFileTypes: true });
	const skills = await Promise.all(
		skillsDirs
			.filter((dir) => dir.isDirectory())
			.map(async (dir) => {
				const skillPackageJson = await fs.readFile(
					path.join(dir.parentPath, dir.name, "package.json"),
					"utf-8"
				);
				const skillData = JSON.parse(skillPackageJson);
				return {
					name: dir?.name,
					description: skillData?.description,
					url: `${repoUrl}/blob/main/skills/${dir?.name}/SKILL.md`,
					triggers: skillData?.skill?.triggers ?? [],
					commands: skillData?.skill?.commands ?? [],
					featured: Boolean(skillData?.skill?.featured),
				};
			})
	);

	// Pick a featured skill: prefer the one with `skill.featured: true`,
	// otherwise fall back to the first skill alphabetically.
	const featured = skills.find((s) => s.featured) ?? skills[0];

	// Per-harness install instructions. The npx commands are identical across
	// most harnesses; only the target directory differs.
	const exampleSkill = featured?.name ?? skills[0]?.name;
	const harnesses = [
		{
			id: "claude-code",
			name: "Claude Code",
			tagline: "Native plugin install",
			recommended: true,
			icon: "fa-solid fa-bolt",
			description:
				"Register this repo as a Claude Code marketplace, then install skills via the <code>/plugin</code> UI.",
			commands: [
				`/plugin marketplace add ${repoSlug}`,
				`/plugin install ${exampleSkill}@${marketplaceName}`,
			],
		},
		{
			id: "claude-agent-sdk",
			name: "Claude Agent SDK",
			tagline: "Vendor with npx",
			icon: "fa-solid fa-cube",
			description:
				"Drop any skill into your agent's <code>SKILL.md</code> directory. No Claude-specific wiring.",
			commands: [`npx ${pkg.name} ${exampleSkill} --dir ~/.claude/skills`],
		},
		{
			id: "cursor",
			name: "Cursor",
			tagline: "Vendor with npx",
			icon: "fa-solid fa-arrow-pointer",
			description:
				"Cursor reads skill folders from your project. Vendor the skill, then point Cursor at it.",
			commands: [`npx ${pkg.name} ${exampleSkill} --dir .cursor/skills`],
		},
		{
			id: "any",
			name: "Any other harness",
			tagline: "Pick your own directory",
			icon: "fa-solid fa-puzzle-piece",
			description:
				"Aider, OpenCode, or anything that reads <code>SKILL.md</code> directories. Choose your target folder.",
			commands: [
				`npx ${pkg.name} --list`,
				`npx ${pkg.name} ${exampleSkill} --dir <your-skills-dir>`,
			],
		},
	];

	return {
		package: {
			name: pkg?.name,
			version: pkg?.version,
			description: pkg?.description,
			author: pkg?.author,
			homepage: pkg?.homepage,
			funding: pkg?.funding,
			keywords: pkg?.keywords,
		},
		title: pkg?.name,
		repo: {
			owner: repoOwner,
			name: repoName,
			slug: repoSlug,
			url: repoUrl,
		},
		marketplace_name: marketplaceName,
		npm: {
			url: `https://www.npmjs.com/package/${pkg?.name}`,
		},
		license: {
			name: pkg?.license,
			url: `${repoUrl}/blob/main/LICENSE`,
		},
		bugs: {
			url: `${repoUrl}/issues`,
		},
		skills,
		featured,
		harnesses,
	};
}
