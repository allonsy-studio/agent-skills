// A small, strict resolver for the custom properties declared on `:root`.
// It understands exactly what the token files use: `var()` with optional
// fallback, and `light-dark()`. Anything else in a color position throws, so a
// token that cannot be resolved to a final value fails loudly instead of being
// skipped by a contrast check.

/** Strip block comments. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Split on a separator at parenthesis depth zero.
 *
 * @param {string} text
 * @param {string} separator single character
 * @returns {string[]}
 */
export function splitTopLevel(text, separator) {
	const parts = [];
	let depth = 0;
	let quote = null;
	let current = "";
	for (const ch of text) {
		if (quote) {
			if (ch === quote) quote = null;
		} else if (ch === '"' || ch === "'") quote = ch;
		else if (ch === "(") depth += 1;
		else if (ch === ")") depth -= 1;
		else if (ch === separator && depth === 0) {
			parts.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	parts.push(current);
	return parts;
}

/**
 * Collect `--name: value` declarations from every rule whose selector list is
 * only `:root` (or `html`). Later declarations win, matching the cascade for
 * a single stylesheet order.
 *
 * @param {string} css
 * @param {Map<string,string>} [into] existing map to extend, for several sheets
 * @returns {Map<string,string>}
 */
export function parseRootProperties(css, into = new Map()) {
	const text = stripComments(css);
	// Find top-level (and nested in @layer) blocks by scanning braces.
	let i = 0;
	const stack = [];
	let selectorStart = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === "{") {
			const prelude = text.slice(selectorStart, i).trim();
			stack.push({ prelude, bodyStart: i + 1 });
			selectorStart = i + 1;
		} else if (ch === "}") {
			const block = stack.pop();
			if (block && isRootSelector(block.prelude)) {
				const body = text.slice(block.bodyStart, i);
				// Skip nested rule bodies: only direct declarations count.
				if (!body.includes("{")) readDeclarations(body, into);
			}
			selectorStart = i + 1;
		} else if (ch === ";" && stack.length === 0) {
			selectorStart = i + 1;
		}
		i += 1;
	}
	return into;
}

function isRootSelector(prelude) {
	return splitTopLevel(prelude, ",").every((s) =>
		/^(:root|html)$/.test(s.trim())
	);
}

function readDeclarations(body, into) {
	for (const declaration of splitTopLevel(body, ";")) {
		const colon = declaration.indexOf(":");
		if (colon === -1) continue;
		const name = declaration.slice(0, colon).trim();
		if (!name.startsWith("--")) continue;
		into.set(name, declaration.slice(colon + 1).trim());
	}
}

/**
 * Resolve a property to its final value for a color-scheme mode.
 *
 * @param {Map<string,string>} properties
 * @param {string} name e.g. `--accent-text`
 * @param {"light"|"dark"} mode
 * @returns {string}
 */
export function resolveProperty(properties, name, mode) {
	if (!properties.has(name)) {
		throw new Error(`Token ${name} is not declared on :root.`);
	}
	return resolveValue(properties, properties.get(name), mode, [name]);
}

/**
 * @param {Map<string,string>} properties
 * @param {string} value
 * @param {"light"|"dark"} mode
 * @param {string[]} trail custom properties being resolved, to catch cycles
 * @returns {string}
 */
export function resolveValue(properties, value, mode, trail = []) {
	let out = value.trim();
	// Innermost function first, so nested light-dark(var(..), var(..)) works.
	for (let guard = 0; guard < 100; guard += 1) {
		const match = /(var|light-dark)\(/.exec(out);
		if (!match) return out;
		const start = match.index;
		const end = matchingParen(out, start + match[0].length - 1);
		const args = splitTopLevel(
			out.slice(start + match[0].length, end),
			","
		).map((a) => a.trim());
		let replacement;
		if (match[1] === "var") {
			const [name, ...fallback] = args;
			if (trail.includes(name)) {
				throw new Error(
					`Cycle while resolving ${trail.join(" -> ")} -> ${name}.`
				);
			}
			if (properties.has(name)) {
				replacement = resolveValue(
					properties,
					properties.get(name),
					mode,
					[...trail, name]
				);
			} else if (fallback.length) {
				replacement = resolveValue(
					properties,
					fallback.join(","),
					mode,
					trail
				);
			} else {
				throw new Error(`Token ${name} is not declared on :root.`);
			}
		} else {
			if (args.length !== 2) {
				throw new Error(
					`light-dark() takes two arguments, found ${args.length}.`
				);
			}
			replacement = resolveValue(
				properties,
				mode === "light" ? args[0] : args[1],
				mode,
				trail
			);
		}
		out = out.slice(0, start) + replacement + out.slice(end + 1);
	}
	throw new Error(`Could not resolve "${value}".`);
}

function matchingParen(text, open) {
	let depth = 0;
	for (let i = open; i < text.length; i += 1) {
		if (text[i] === "(") depth += 1;
		else if (text[i] === ")") {
			depth -= 1;
			if (depth === 0) return i;
		}
	}
	throw new Error(`Unbalanced parentheses in "${text}".`);
}

/**
 * Pull every `font-family` family name out of a custom-property value or
 * declaration value, unquoted, in order.
 *
 * @param {string} value
 * @returns {string[]}
 */
export function familiesOf(value) {
	return splitTopLevel(value, ",")
		.map((f) => f.trim().replace(/^["']|["']$/g, ""))
		.filter(Boolean);
}
