import fs from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";

/**
 * Shared markdown renderer for skill `SKILL.md` bodies. Relative links and
 * images are rewritten to absolute GitHub URLs via the per-render `env` so the
 * rendered overview works when lifted out of the skill directory.
 */
const md = new MarkdownIt({ html: true, linkify: true, typographer: true });

const renderToken = (tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options);
const defaultLinkOpen = md.renderer.rules.link_open ?? renderToken;

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
	const href = tokens[idx].attrGet("href");
	if (href && env?.blobBase && !/^(https?:|#|mailto:)/i.test(href)) {
		tokens[idx].attrSet("href", `${env.blobBase}/${href.replace(/^\.?\//, "")}`);
	}
	return defaultLinkOpen(tokens, idx, options, env, self);
};

md.renderer.rules.image = (tokens, idx, options, env, self) => {
	const src = tokens[idx].attrGet("src");
	if (src && env?.rawBase && !/^https?:/i.test(src)) {
		tokens[idx].attrSet("src", `${env.rawBase}/${src.replace(/^\.?\//, "")}`);
	}
	return renderToken(tokens, idx, options, env, self);
};

/** Strip a leading YAML frontmatter block from a markdown string. */
const stripFrontmatter = (raw) => raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

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

	const repoType = pkg.repository?.type;
	const repoUrl = pkg?.repository?.url?.replace(new RegExp(`\\.?${repoType}\\+?`), "");
	const repoSegments = repoUrl.replace(/^https?:\/\/[^/]+\//, "").split("/");
	const repoOwner = repoSegments?.[0];
	const repoName = repoSegments?.[1];
	const repoSlug = repoOwner && repoName ? `${repoOwner}/${repoName}` : "";
	const rawHost = repoUrl.replace("github.com", "raw.githubusercontent.com");

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
				const hasScripts = await exists(path.join(skillDir, "scripts"));
				const blobBase = `${repoUrl}/blob/main/skills/${dir.name}`;
				const rawBase = `${rawHost}/main/skills/${dir.name}`;

				return {
					name: dir?.name,
					description: skillData?.description,
					homepage: skillData?.homepage,
					url: `${blobBase}/SKILL.md`,
					detailUrl: `/skills/${dir.name}/`,
					runtime: skillData?.skill?.runtime,
					// A skill with implementation scripts is runnable; otherwise it's
					// pure prompt + reference material.
					flavor: hasScripts ? "implementation" : "reference",
					category: skillData?.skill?.category,
					keywords: skillData?.keywords ?? [],
					triggers: skillData?.skill?.triggers ?? [],
					commands: skillData?.skill?.commands ?? [],
					featured: Boolean(skillData?.skill?.featured),
					overviewHtml: skillMd ? md.render(stripFrontmatter(skillMd), { blobBase, rawBase }) : "",
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

	const npmUrl = `https://www.npmjs.com/package/${pkg?.name}`;

	// Trust signals. Badge URLs mirror the set defined in README.md.
	const badges = [
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
	];

	// "Built to be trusted" pillars. Copy may contain inline HTML (<code>).
	const quality = [
		{
			icon: "fa-solid fa-feather-pointed",
			title: "Expert-written",
			text: "Every <code>SKILL.md</code> prompt is hand-authored by domain experts — not auto-generated boilerplate.",
		},
		{
			icon: "fa-solid fa-vial-circle-check",
			title: "Fully tested",
			text: "Each skill ships a <code>node --test</code> suite with c8 coverage, so behavior is verified, not assumed.",
		},
		{
			icon: "fa-solid fa-wand-magic-sparkles",
			title: "Linted & formatted",
			text: "ESLint and Prettier run on every commit for consistent, reviewable code.",
		},
		{
			icon: "fa-solid fa-robot",
			title: "Eval-backed",
			text: "LLM eval suites check that each skill triggers and behaves correctly on real prompts.",
		},
		{
			icon: "fa-solid fa-circle-check",
			title: "CI on every change",
			text: "Tests, linting, and evals run in GitHub Actions before anything merges to <code>main</code>.",
		},
		{
			icon: "fa-solid fa-puzzle-piece",
			title: "No vendor lock-in",
			text: "Plain <code>SKILL.md</code> directories — install natively in Claude Code or vendor into any harness.",
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
			url: npmUrl,
		},
		license: {
			name: pkg?.license,
			url: `${repoUrl}/blob/main/LICENSE`,
		},
		bugs: {
			url: `${repoUrl}/issues`,
		},
		maintainer: {
			name: "Allons-y Studio",
			person: "Cassondra Roberts",
			url: "https://allons-y.studio",
		},
		skills,
		featured,
		harnesses,
		badges,
		quality,
	};
}
