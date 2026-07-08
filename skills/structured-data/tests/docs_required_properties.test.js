import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { REQUIRED_PROPERTIES } from "../scripts/structured-data-core.js";

// Guards against the two hand-maintained copies of Google's "required for rich
// results" data drifting apart: the REQUIRED_PROPERTIES table in the core, and
// the "Yes" rows in references/schema-types/*.md. If you change one, this test
// makes you change the other.

const here = dirname(fileURLToPath(import.meta.url));
const refDir = join(here, "..", "references", "schema-types");

const TYPE_TO_FILE = {
	Article: "article.md",
	Product: "product.md",
	Recipe: "recipe.md",
	Event: "event.md",
};

// Pull the top-level property names whose "required for rich results" column
// reads "Yes". Sub-property rows (e.g. `offers.price`) and multi-property rows
// are intentionally excluded — REQUIRED_PROPERTIES only tracks top-level ones.
function topLevelYesProps(md) {
	const props = [];
	for (const line of md.split("\n")) {
		const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]*)\|/);
		if (!m) continue;
		const [, name, requiredCell] = m;
		if (name.includes(".")) continue;
		if (/^yes\b/i.test(requiredCell.trim())) props.push(name);
	}
	return props.sort();
}

for (const [type, file] of Object.entries(TYPE_TO_FILE)) {
	test(`${file} "Yes" rows match REQUIRED_PROPERTIES.${type}`, () => {
		const md = fs.readFileSync(join(refDir, file), "utf8");
		assert.deepEqual(
			topLevelYesProps(md),
			[...REQUIRED_PROPERTIES[type]].sort(),
			`${file} required-for-rich-results rows have drifted from REQUIRED_PROPERTIES.${type}`
		);
	});
}
