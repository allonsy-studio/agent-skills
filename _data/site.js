import fs from "node:fs/promises";
import path from "node:path";

import {
	createSkillRenderer,
	deriveFlavor,
	highlightTree,
	renderSkillOverview,
	skillGitHubBases,
	skillTreeText,
} from "./lib/skill-metadata.js";

/**
 * Shared markdown renderer for skill `SKILL.md` bodies. Relative links and
 * images are rewritten to absolute GitHub URLs so the rendered overview works
 * when lifted out of the skill directory. See `./lib/skill-metadata.js`.
 */
const md = createSkillRenderer();

const exists = (target) =>
	fs
		.access(target)
		.then(() => true)
		.catch(() => false);

/**
 * Eleventy global data: package, repo, skills, harnesses, trust signals, etc.
 *
 * @param {{ eleventy: { env: { root: string } } }} configData
 */
export default async function (configData) {
	const rootDir = path.resolve(configData.eleventy.env.root);

	const packageJson = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
	const pkg = JSON.parse(packageJson);

	// Normalize the clone URL to a plain web URL: drop the `git+` prefix and the
	// `.git` suffix. Leaving `.git` on breaks the CI badge (…/agent-skills.git/
	// actions/…) and the coverage badge (shields reads repo "agent-skills.git").
	const repoUrl = pkg?.repository?.url?.replace(/^git\+/, "").replace(/\.git$/, "");
	const repoSegments = repoUrl.replace(/^https?:\/\/[^/]+\//, "").split("/");
	const repoOwner = repoSegments?.[0];
	const repoName = repoSegments?.[1];
	const repoSlug = repoOwner && repoName ? `${repoOwner}/${repoName}` : "";

	const marketplaceJson = await fs
		.readFile(path.join(rootDir, ".claude-plugin", "marketplace.json"), "utf-8")
		.catch(() => null);
	const marketplaceName = marketplaceJson ? JSON.parse(marketplaceJson).name : repoName;

	const skillsDirs = await fs.readdir(path.join(rootDir, "skills"), { withFileTypes: true });
	const skills = await Promise.all(
		skillsDirs
			.filter((dir) => dir.isDirectory())
			.map(async (dir) => {
				const skillDir = path.join(dir.parentPath, dir.name);
				const skillData = JSON.parse(await fs.readFile(path.join(skillDir, "package.json"), "utf-8"));

				const skillMd = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf-8").catch(() => "");
				const [hasScripts, hasTests, hasEvals, hasPreview] = await Promise.all([
					exists(path.join(skillDir, "scripts")),
					exists(path.join(skillDir, "tests")),
					exists(path.join(skillDir, "evals", "evals.json")),
					exists(path.join(skillDir, "preview")),
				]);
				const { blobBase, rawBase } = skillGitHubBases({ repoUrl, skillName: dir.name });

				// A `|--` folder-structure view of the skill's source directory,
				// shown above the rendered SKILL.md on the detail page so readers see
				// the shape of what they're installing before the prose. Driven by the
				// git-tracked file list (mirrors what ships, skips gitignored cruft),
				// then tokenized with Prism's `treeview` grammar so the vendored
				// `prism-treeview.css` renders branch lines and file-type icons.
				const treeHtml = highlightTree(await skillTreeText(skillDir, dir.name));

				return {
					name: dir?.name,
					description: skillData?.description,
					homepage: skillData?.homepage,
					url: `${blobBase}/SKILL.md`,
					detailUrl: `/skills/${dir.name}/`,
					// A skill with a `preview/` directory ships a hosted, interactive
					// preview page. Convention: it builds to `/<skill>/` (see the
					// preview's permalink). Root-relative so HtmlBasePlugin adds the
					// site base path. Falls back to an external `homepage` if set.
					previewUrl: hasPreview ? `/${dir.name}/` : skillData?.homepage ?? null,
					runtime: skillData?.skill?.runtime,
					flavor: deriveFlavor(hasScripts),
					category: skillData?.skill?.category,
					keywords: skillData?.keywords ?? [],
					triggers: skillData?.skill?.triggers ?? [],
					commands: skillData?.skill?.commands ?? [],
					featured: Boolean(skillData?.skill?.featured),
					// Trust facts, derived from the skill on disk rather than asserted.
					// The `docs/tests` contract suite fails CI if any skill lacks these,
					// so the "every skill tested / eval-backed" claims can't go stale.
					hasTests,
					hasEvals,
					treeHtml,
					overviewHtml: renderSkillOverview(md, skillMd, { blobBase, rawBase }),
				};
			})
	);

	// Pick a featured skill: prefer the one with `skill.featured: true`,
	// otherwise fall back to the first skill alphabetically.
	const featured = skills.find((s) => s.featured) ?? skills[0];

	const npmUrl = `https://www.npmjs.com/package/${pkg?.name}`;

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
			url: npmUrl,
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
		harnesses: [
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
					`/plugin install ${featured?.name ?? skills[0]?.name}@${marketplaceName}`,
				],
			},
			{
				id: "claude-agent-sdk",
				name: "Claude Agent SDK",
				tagline: "Vendor with npx",
				icon: "fa-solid fa-cube",
				description:
					"Drop any skill into your agent's <code>SKILL.md</code> directory. No Claude-specific wiring.",
				commands: [`npx ${pkg.name} ${featured?.name ?? skills[0]?.name} --dir ~/.claude/skills`],
			},
			{
				id: "cursor",
				name: "Cursor",
				tagline: "Vendor with npx",
				icon: "fa-solid fa-arrow-pointer",
				description:
					"Cursor reads skill folders from your project. Vendor the skill, then point Cursor at it.",
				commands: [`npx ${pkg.name} ${featured?.name ?? skills[0]?.name} --dir .cursor/skills`],
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
					`npx ${pkg.name} ${featured?.name ?? skills[0]?.name} --dir <your-skills-dir>`,
				],
			},
		],
		badges: [
			{
				label: "CI",
				url: `${repoUrl}/actions/workflows/test.yml`,
				src: `${repoUrl}/actions/workflows/test.yml/badge.svg?branch=main`,
				alt: "CI build status",
			},
			{
				label: "npm version",
				url: npmUrl,
				src: `https://img.shields.io/npm/v/${pkg?.name}?logo=npm`,
				alt: "Latest npm version",
			},
			{
				label: "downloads",
				url: npmUrl,
				src: `https://img.shields.io/npm/dw/${pkg?.name}?logo=npm`,
				alt: "Weekly npm downloads",
			},
			{
				label: "coverage",
				url: `${repoUrl}/blob/main/.c8rc.json`,
				src: `https://img.shields.io/nycrc/${repoSlug}?config=.c8rc.json`,
				alt: "Test coverage threshold",
			},
			{
				label: "node",
				url: "https://nodejs.org",
				src: "https://img.shields.io/badge/node-%3E%3D24-brightgreen?logo=node.js",
				alt: "Requires Node.js 24 or newer",
			},
			{
				label: "conventional commits",
				url: "https://conventionalcommits.org/",
				src: "https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg",
				alt: "Conventional Commits",
			},
		],
	};
}
