import assert from "node:assert/strict";
import { test } from "node:test";

import {
	DEFAULT_BRANCH,
	createSkillRenderer,
	deriveFlavor,
	rawHostFor,
	renderSkillOverview,
	skillGitHubBases,
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

test("Prism-highlights fenced code into a language-tagged block", () => {
	const md = createSkillRenderer();
	const html = md.render("```bash\nnpm install foo\n```\n");
	assert.match(html, /<pre class="language-bash"><code class="language-bash">/);
	// Tokenized by Prism so the shared theme colors the snippet.
	assert.match(html, /<span class="token function">npm<\/span>/);
});

test("unlabeled fences fall back to a tokenized bash block", () => {
	const md = createSkillRenderer();
	const html = md.render("```\nnpm install foo && echo done\n```\n");
	assert.match(html, /<pre class="language-bash"><code class="language-bash">/);
	// Tokenized as bash so shell operators are still colored, and HTML is escaped.
	assert.match(html, /<span class="token function">npm<\/span>/);
	assert.doesNotMatch(html, /class="language-none"/);
});
