// Flat rule list from a stylesheet: just enough structure for the brand
// checks (selector, body, enclosing @media). Not a general CSS parser.

/** Strip block comments. */
export const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * @param {string} css
 * @returns {{ selector: string, body: string, media: string | null }[]}
 */
export function parseRules(css) {
	const text = stripComments(css);
	const rules = [];
	const stack = [];
	let start = 0;
	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];
		if (ch === "{") {
			stack.push({ prelude: text.slice(start, i).trim(), open: i + 1 });
			start = i + 1;
		} else if (ch === "}") {
			const block = stack.pop();
			if (block) {
				const body = text.slice(block.open, i);
				const isGroup = /^@(media|supports|layer|container)/.test(block.prelude);
				if (!isGroup && !body.includes("{")) {
					const media = stack
						.map((s) => s.prelude)
						.find((p) => p.startsWith("@media"));
					rules.push({
						selector: block.prelude,
						body: body.trim(),
						media: media ?? null,
					});
				}
			}
			start = i + 1;
		} else if (ch === ";" && stack.length === 0) {
			start = i + 1;
		}
	}
	return rules;
}

/**
 * Values of a property across a list of rules, with the rule they came from.
 *
 * @param {ReturnType<typeof parseRules>} rules
 * @param {string} property
 * @returns {{ value: string, rule: ReturnType<typeof parseRules>[number] }[]}
 */
export function declarationsOf(rules, property) {
	const pattern = new RegExp(`(?:^|[;\\s])${property}\\s*:\\s*([^;]+)`, "g");
	const found = [];
	for (const rule of rules) {
		for (const match of rule.body.matchAll(pattern)) {
			found.push({ value: match[1].trim(), rule });
		}
	}
	return found;
}
