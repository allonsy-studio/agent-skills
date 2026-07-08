import assert from "node:assert/strict";
import { test } from "node:test";

import {
	DEFAULT_BRANCH,
	TREE_IGNORE,
	buildTreeFromPaths,
	createSkillRenderer,
	deriveFlavor,
	rawHostFor,
	readSkillTree,
	renderSkillOverview,
	renderSkillTree,
	skillGitHubBases,
	skillTreeText,
	stripFrontmatter,
} from "../../_data/lib/skill-metadata.js";

const REPO_URL = "https://github.com/allonsy-studio/agent-skills";
const bases = skillGitHubBases({ repoUrl: REPO_URL, skillName: "demo" });

test("rawHostFor maps github.com to the raw host", () => {
	assert.equal(
		rawHostFor(REPO_URL),
		"https://raw.githubusercontent.com/allonsy-studio/agent-skills"
	);
});

test("skillGitHubBases builds blob and raw bases on the default branch", () => {
	assert.equal(DEFAULT_BRANCH, "main");
	assert.deepEqual(bases, {
		blobBase: `${REPO_URL}/blob/main/skills/demo`,
		rawBase: "https://raw.githubusercontent.com/allonsy-studio/agent-skills/main/skills/demo",
	});
});

test("skillGitHubBases honors an explicit branch", () => {
	const { blobBase, rawBase } = skillGitHubBases({
		repoUrl: REPO_URL,
		skillName: "demo",
		branch: "next",
	});
	assert.ok(blobBase.includes("/blob/next/skills/demo"));
	assert.ok(rawBase.includes("/next/skills/demo"));
});

test("deriveFlavor reflects whether a skill ships scripts", () => {
	assert.equal(deriveFlavor(true), "implementation");
	assert.equal(deriveFlavor(false), "reference");
});

test("stripFrontmatter removes only the leading YAML block", () => {
	const body = "# Heading\n\nSome text with a --- rule below.\n\n---\n";
	assert.equal(stripFrontmatter(`---\nname: demo\ndescription: x\n---\n${body}`), body);
});

test("stripFrontmatter handles CRLF frontmatter", () => {
	assert.equal(stripFrontmatter("---\r\nname: demo\r\n---\r\nbody"), "body");
});

test("stripFrontmatter is a no-op when there is no frontmatter", () => {
	assert.equal(stripFrontmatter("# Just a heading\n"), "# Just a heading\n");
});

test("renderer rewrites relative links to the blob base", () => {
	const md = createSkillRenderer();
	const html = md.render("[ref](./references/guide.md)", bases);
	assert.ok(html.includes(`href="${bases.blobBase}/references/guide.md"`));
});

test("renderer leaves absolute, anchor, and mailto links untouched", () => {
	const md = createSkillRenderer();
	const html = md.render(
		"[a](https://example.com) [b](#section) [c](mailto:x@y.z)",
		bases
	);
	assert.ok(html.includes('href="https://example.com"'));
	assert.ok(html.includes('href="#section"'));
	assert.ok(html.includes('href="mailto:x@y.z"'));
	assert.ok(!html.includes(bases.blobBase));
});

test("renderer rewrites relative images to the raw base", () => {
	const md = createSkillRenderer();
	const html = md.render("![shot](assets/demo.png)", bases);
	assert.ok(html.includes(`src="${bases.rawBase}/assets/demo.png"`));
});

test("renderer leaves absolute images untouched", () => {
	const md = createSkillRenderer();
	const html = md.render("![x](https://cdn.example.com/x.png)", bases);
	assert.ok(html.includes('src="https://cdn.example.com/x.png"'));
	assert.ok(!html.includes(bases.rawBase));
});

test("renderSkillOverview strips frontmatter before rendering", () => {
	const md = createSkillRenderer();
	const html = renderSkillOverview(md, "---\nname: demo\n---\n# Body\n", bases);
	assert.ok(html.includes("<h1>Body</h1>"));
	assert.ok(!html.includes("name: demo"));
});

test("renderSkillOverview returns an empty string for empty input", () => {
	const md = createSkillRenderer();
	assert.equal(renderSkillOverview(md, "", bases), "");
});

test("wraps tables in a horizontal scroll container", () => {
	const md = createSkillRenderer();
	const html = md.render("| a | b |\n| - | - |\n| 1 | 2 |");
	assert.match(html, /<div class="table-scroll">\s*<table>/);
	assert.match(html, /<\/table>\s*<\/div>/);
});

/**
 * Build an in-memory `fs.promises`-shaped `readdir` from a nested plain object.
 * A value that is an object is a directory; any other value is a file.
 */
function mockFs(tree) {
	const dirent = (name, isDir) => ({ name, isDirectory: () => isDir });
	return {
		async readdir(dir) {
			const node = dir
				.split("/")
				.filter(Boolean)
				.reduce((acc, part) => acc?.[part], tree);
			return Object.entries(node).map(([name, value]) =>
				dirent(name, value && typeof value === "object")
			);
		},
	};
}

test("readSkillTree lists directories before files, each alphabetical", async () => {
	const fsImpl = mockFs({ "package.json": "", SKILL: "", scripts: {}, assets: {} });
	const entries = await readSkillTree("", fsImpl);
	assert.deepEqual(
		entries.map((entry) => `${entry.name}${entry.isDir ? "/" : ""}`),
		["assets/", "scripts/", "package.json", "SKILL"]
	);
});

test("readSkillTree skips ignored names and recurses into subdirectories", async () => {
	assert.ok(TREE_IGNORE.has("node_modules"));
	const fsImpl = mockFs({
		node_modules: { junk: "" },
		".git": { HEAD: "" },
		scripts: { "core.js": "" },
	});
	const entries = await readSkillTree("", fsImpl);
	assert.deepEqual(
		entries.map((entry) => entry.name),
		["scripts"]
	);
	assert.deepEqual(
		entries[0].children.map((child) => child.name),
		["core.js"]
	);
});

test("renderSkillTree draws an ASCII tree with |-- connectors", () => {
	const entries = [
		{ name: "assets", isDir: true, children: [{ name: "map.json", isDir: false, children: [] }] },
		{ name: "SKILL.md", isDir: false, children: [] },
		{ name: "package.json", isDir: false, children: [] },
	];
	assert.equal(
		renderSkillTree("demo", entries),
		["demo/", "|-- assets/", "|   `-- map.json", "|-- SKILL.md", "`-- package.json"].join("\n")
	);
});

test("renderSkillTree indents nested directories under the last branch", () => {
	const entries = [
		{
			name: "references",
			isDir: true,
			children: [
				{
					name: "schema-types",
					isDir: true,
					children: [{ name: "article.md", isDir: false, children: [] }],
				},
			],
		},
	];
	assert.equal(
		renderSkillTree("demo", entries),
		["demo/", "`-- references/", "    `-- schema-types/", "        `-- article.md"].join("\n")
	);
});

test("buildTreeFromPaths nests files under directories, directories first", () => {
	const entries = buildTreeFromPaths([
		"SKILL.md",
		"package.json",
		"scripts/core.js",
		"scripts/util.js",
		"assets/logo.svg",
	]);
	assert.equal(
		renderSkillTree("demo", entries),
		[
			"demo/",
			"|-- assets/",
			"|   `-- logo.svg",
			"|-- scripts/",
			"|   |-- core.js",
			"|   `-- util.js",
			"|-- package.json",
			"`-- SKILL.md",
		].join("\n")
	);
});

test("buildTreeFromPaths handles a flat, single-file list", () => {
	assert.deepEqual(buildTreeFromPaths(["SKILL.md"]), [
		{ name: "SKILL.md", isDir: false, children: [] },
	]);
});

test("skillTreeText renders the git-tracked file list, honoring .gitignore", async () => {
	let walked = false;
	// The tracked list omits a gitignored `.env`, so it never reaches the tree.
	const listTrackedFiles = async () => ["SKILL.md", ".env.example", "scripts/core.js"];
	const fsImpl = {
		readdir: async () => {
			walked = true;
			return [];
		},
	};
	const text = await skillTreeText("skills/demo", "demo", { listTrackedFiles, fsImpl });
	assert.equal(
		text,
		["demo/", "|-- scripts/", "|   `-- core.js", "|-- .env.example", "`-- SKILL.md"].join("\n")
	);
	assert.equal(walked, false, "should not walk the filesystem when git succeeds");
	assert.ok(!text.includes("\n.env\n") && !text.includes("-- .env\n"), ".env stays out of the tree");
});

test("skillTreeText falls back to the filesystem walk when git is unavailable", async () => {
	const listTrackedFiles = async () => {
		throw new Error("not a git repository");
	};
	const fsImpl = mockFs({ "SKILL.md": "", scripts: { "core.js": "" } });
	const text = await skillTreeText("", "demo", { listTrackedFiles, fsImpl });
	assert.equal(text, ["demo/", "|-- scripts/", "|   `-- core.js", "`-- SKILL.md"].join("\n"));
});

test("skillTreeText falls back to the filesystem walk when git returns nothing", async () => {
	const listTrackedFiles = async () => [];
	const fsImpl = mockFs({ "SKILL.md": "" });
	const text = await skillTreeText("", "demo", { listTrackedFiles, fsImpl });
	assert.equal(text, ["demo/", "`-- SKILL.md"].join("\n"));
});
