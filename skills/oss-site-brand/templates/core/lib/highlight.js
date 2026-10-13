// Build-time syntax highlighting with Prism. Output is escaped text wrapped in
// Prism token spans, styled by the --tok-* tokens.

import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";

loadLanguages(["bash", "css", "diff", "json", "typescript", "yaml"]);

/** Aliases authors reach for, mapped to Prism grammar names. */
const LANGUAGES = {
	sh: "bash",
	shell: "bash",
	js: "javascript",
	ts: "typescript",
	html: "markup",
	yml: "yaml",
};

/**
 * Syntax-highlight code at build time. Output is escaped text wrapped in
 * Prism token spans; unknown languages fall back to escaped plain text.
 *
 * @param {string} code
 * @param {string} [language]
 * @returns {string}
 */
export function highlight(code, language = "") {
	const name = LANGUAGES[language] ?? language;
	const grammar = Prism.languages[name];
	if (!grammar) {
		return code
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}
	return Prism.highlight(code, grammar, name);
}
