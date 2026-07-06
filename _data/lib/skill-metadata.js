/**
 * Pure helpers for turning a skill directory into the metadata the marketplace
 * site renders. Extracted from `_data/site.js` so the link-rewriting,
 * frontmatter-stripping, and flavor rules can be unit tested without booting
 * Eleventy. `_data/site.js` is the only production consumer; the tests in
 * `docs/tests/` exercise these directly.
 */
import MarkdownIt from "markdown-it";

/** Default branch used when building GitHub `blob`/raw URLs for skill assets. */
export const DEFAULT_BRANCH = "main";

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
