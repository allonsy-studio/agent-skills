/**
 * Pure helpers for turning a skill directory into the metadata the marketplace
 * site renders. Extracted from `_data/site.js` so the link-rewriting,
 * frontmatter-stripping, and flavor rules can be unit tested without booting
 * Eleventy. `_data/site.js` is the only production consumer; the tests in
 * `docs/tests/` exercise these directly.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import MarkdownIt from "markdown-it";
import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";
import "prismjs/plugins/treeview/prism-treeview.js";

const FALLBACK_LANGUAGE = "bash";
loadLanguages([FALLBACK_LANGUAGE, "json", "markdown", "yaml"]);

/**
 * Prism-highlight a fenced code block into the same `pre.language-*` markup the
 * site's `{% highlight %}` shortcode emits, so the shared Prism theme formats the
 * SKILL.md code snippets rendered on the per-skill landing pages. Unknown or
 * unlabeled languages fall back to `bash` — most SKILL.md fences are shell
 * commands — so every block is tokenized and picks up the Prism styling.
 *
 * @param {string} code
 * @param {string} lang
 * @returns {string}
 */
function highlightFence(code, lang) {
	const language = lang && Prism.languages[lang] ? lang : FALLBACK_LANGUAGE;
	const body = Prism.highlight(code, Prism.languages[language], language);
	return `<pre class="language-${language}"><code class="language-${language}">${body}</code></pre>`;
}

const execFileAsync = promisify(execFile);

/** Default branch used when building GitHub `blob`/raw URLs for skill assets. */
export const DEFAULT_BRANCH = "main";

/**
 * Names never shown in a skill's folder-structure tree: dependency installs and
 * VCS/OS cruft that would only add noise to the vendored view. Only consulted by
 * the filesystem-walk fallback; the git-driven path lists tracked files, which
 * already excludes anything `.gitignore` covers.
 */
export const TREE_IGNORE = new Set(["node_modules", ".git", ".DS_Store", ".yarn"]);

/**
 * Order tree entries: directories before files, each group sorted
 * alphabetically (case-insensitive) so the rendered tree is stable and
 * independent of filesystem/git read order.
 *
 * @param {{ name: string, isDir: boolean }} a
 * @param {{ name: string, isDir: boolean }} b
 */
const compareTreeEntries = (a, b) =>
	a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1;

/**
 * Build a sorted `{ name, isDir, children }` tree from a flat list of
 * directory-relative file paths (POSIX separators), as emitted by
 * `git ls-files`. A path with segments before its last is a file nested under
 * directories; every intermediate segment becomes a directory node. This is the
 * pure core of the tree: no filesystem access, so a path list fully determines
 * the output.
 *
 * @param {string[]} relPaths
 * @returns {Array<{ name: string, isDir: boolean, children: any[] }>}
 */
export function buildTreeFromPaths(relPaths) {
	const root = new Map();

	for (const rel of relPaths) {
		const segments = rel.split("/").filter(Boolean);
		let level = root;
		segments.forEach((segment, index) => {
			const isDir = index < segments.length - 1;
			if (!level.has(segment)) {
				level.set(segment, { name: segment, isDir, children: new Map() });
			}
			level = level.get(segment).children;
		});
	}

	const toEntries = (level) =>
		[...level.values()]
			.map((node) => ({ name: node.name, isDir: node.isDir, children: toEntries(node.children) }))
			.sort(compareTreeEntries);

	return toEntries(root);
}

/**
 * Recursively read a directory into a sorted tree of `{ name, isDir, children }`
 * nodes. Names in `TREE_IGNORE` are skipped. Used as the fallback when git is
 * unavailable; the injectable `fsImpl` keeps the walk unit-testable against a
 * mock filesystem.
 *
 * @param {string} dir
 * @param {Pick<typeof fs, "readdir">} [fsImpl]
 * @returns {Promise<Array<{ name: string, isDir: boolean, children: any[] }>>}
 */
export async function readSkillTree(dir, fsImpl = fs) {
	const dirents = await fsImpl.readdir(dir, { withFileTypes: true });
	const entries = await Promise.all(
		dirents
			.filter((dirent) => !TREE_IGNORE.has(dirent.name))
			.map(async (dirent) => {
				const isDir = dirent.isDirectory();
				return {
					name: dirent.name,
					isDir,
					children: isDir ? await readSkillTree(path.join(dir, dirent.name), fsImpl) : [],
				};
			})
	);
	return entries.sort(compareTreeEntries);
}

/**
 * List the git-tracked files inside `dir`, relative to `dir`. Tracked files are
 * exactly what the skill publishes/vendors, and the set already excludes
 * anything `.gitignore` covers (a local `.env`, build output, etc.). Uses
 * NUL-separated output so paths with spaces survive.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function gitLsFiles(dir) {
	const { stdout } = await execFileAsync("git", ["ls-files", "-z", "--", "."], { cwd: dir });
	return stdout.split("\0").filter(Boolean);
}

/**
 * Build the ASCII folder-structure text for a skill directory, or `null` when
 * the directory holds nothing to show. Prefers the git-tracked file list
 * (faithful to what ships, honors `.gitignore`); falls back to a filesystem
 * walk when git isn't available or the directory isn't in a work tree (e.g.
 * `npx eleventy` from a published tarball). Both sources feed the same renderer.
 *
 * The `try` wraps only the git call: a failure there is expected and recoverable,
 * but a bug in `buildTreeFromPaths` must surface rather than be masked as a
 * fallback. The fallback filters by `TREE_IGNORE` alone, so — unlike the git
 * path — it can surface content `.gitignore` would hide; a git failure therefore
 * warns, so a silent regression (a leaked `.env`, build output) is visible.
 *
 * @param {string} dir
 * @param {string} rootName
 * @param {{
 *   listTrackedFiles?: (dir: string) => Promise<string[]>,
 *   fsImpl?: Pick<typeof fs, "readdir">,
 *   warn?: (message: string) => void,
 * }} [options]
 * @returns {Promise<string | null>}
 */
export async function skillTreeText(dir, rootName, options = {}) {
	const { listTrackedFiles = gitLsFiles, fsImpl = fs, warn = console.warn } = options;

	let tracked = null;
	try {
		tracked = await listTrackedFiles(dir);
	} catch (error) {
		warn(
			`skillTreeText: \`git ls-files\` failed for ${dir}; falling back to a ` +
				`filesystem walk that does not honor .gitignore (${error?.message ?? error})`
		);
	}

	// Use the git-tracked list when it has entries; otherwise walk the filesystem
	// (git unavailable, or a skill with no tracked files — e.g. an uncommitted
	// skill during local dev).
	const entries =
		tracked && tracked.length > 0 ? buildTreeFromPaths(tracked) : await readSkillTree(dir, fsImpl);

	return entries.length > 0 ? renderSkillTree(rootName, entries) : null;
}

/**
 * Render a tree of entries (from `buildTreeFromPaths` or `readSkillTree`) as an
 * ASCII folder structure using `|--` / `` `-- `` connectors, the way
 * `tree --charset=ascii` draws it. The root directory name is the first line;
 * directories get a trailing slash.
 *
 * @param {string} rootName
 * @param {Array<{ name: string, isDir: boolean, children: any[] }>} entries
 * @returns {string}
 */
export function renderSkillTree(rootName, entries) {
	const lines = [`${rootName}/`];

	const walk = (nodes, prefix) => {
		nodes.forEach((node, index) => {
			const isLast = index === nodes.length - 1;
			const connector = isLast ? "`-- " : "|-- ";
			lines.push(`${prefix}${connector}${node.name}${node.isDir ? "/" : ""}`);
			if (node.isDir && node.children.length > 0) {
				walk(node.children, `${prefix}${isLast ? "    " : "|   "}`);
			}
		});
	};

	walk(entries, "");
	return lines.join("\n");
}

/**
 * Tokenize an ASCII folder tree (from `renderSkillTree`/`skillTreeText`) with
 * Prism's `treeview` grammar, returning the inner HTML for a
 * `<code class="language-treeview">`. The grammar recognizes the `|-- ` / `|   `
 * / `` `-- `` / 4-space connectors this project emits and tags each entry with
 * `dir` / `ext-<type>` / `dotfile` classes, which the vendored
 * `prism-treeview.css` renders as branch lines and file-type icons. Prism
 * escapes `<`/`&` in names, so the result is safe to inject with `| safe`.
 * Returns "" for a null/empty tree so the template can skip the section.
 *
 * @param {string | null} treeText
 * @returns {string}
 */
export function highlightTree(treeText) {
	return treeText ? Prism.highlight(treeText, Prism.languages.treeview, "treeview") : "";
}

/** Map a github.com repository URL to its raw.githubusercontent.com host. */
export const rawHostFor = (repoUrl) => repoUrl.replace("github.com", "raw.githubusercontent.com");

/**
 * Build the GitHub `blob` and raw base URLs for a skill directory. Centralizes
 * the branch and host assumptions that would otherwise be re-derived as ad-hoc
 * string surgery at each call site.
 *
 * @param {{ repoUrl: string, skillName: string, branch?: string }} options
 * @returns {{ blobBase: string, rawBase: string }}
 */
export const skillGitHubBases = ({ repoUrl, skillName, branch = DEFAULT_BRANCH }) => ({
	blobBase: `${repoUrl}/blob/${branch}/skills/${skillName}`,
	rawBase: `${rawHostFor(repoUrl)}/${branch}/skills/${skillName}`,
});

/** Strip a leading YAML frontmatter block from a markdown string. */
export const stripFrontmatter = (raw) => raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

/**
 * Derive a skill's flavor from whether it ships implementation scripts. A skill
 * with a `scripts/` directory is runnable; otherwise it's pure prompt +
 * reference material.
 *
 * @param {boolean} hasScripts
 * @returns {"implementation" | "reference"}
 */
export const deriveFlavor = (hasScripts) => (hasScripts ? "implementation" : "reference");

const renderToken = (tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options);

/**
 * Build a MarkdownIt renderer for skill `SKILL.md` bodies. Relative links and
 * images are rewritten to absolute GitHub URLs via the per-render `env`
 * (`{ blobBase, rawBase }`) so the rendered overview works when lifted out of
 * the skill directory. Absolute, anchor (`#`), and `mailto:` targets are left
 * untouched.
 *
 * @returns {MarkdownIt}
 */
export function createSkillRenderer() {
	const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
	md.set({ highlight: (code, lang) => highlightFence(code, lang) });
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

	// Wrap tables in a horizontally scrollable container so a wide table scrolls
	// within the prose instead of pushing the whole page past the viewport on
	// narrow screens.
	md.renderer.rules.table_open = () => '<div class="table-scroll">\n<table>\n';
	md.renderer.rules.table_close = () => "</table>\n</div>\n";

	return md;
}

/**
 * Render a skill's SKILL.md body to HTML with relative asset URLs rewritten.
 * Returns "" for empty input so callers can treat a missing overview uniformly.
 *
 * @param {MarkdownIt} md
 * @param {string} skillMd
 * @param {{ blobBase: string, rawBase: string }} bases
 * @returns {string}
 */
export function renderSkillOverview(md, skillMd, bases) {
	return skillMd ? md.render(stripFrontmatter(skillMd), bases) : "";
}
