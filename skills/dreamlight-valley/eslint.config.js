import baseConfig from "../../eslint.config.js";

import { defineConfig } from "eslint/config";
import jsonc from "eslint-plugin-jsonc";

export default defineConfig([
    ...baseConfig,
	{
		files: ["**/gatherables.json"],
		plugins: { jsonc },
		language: "jsonc/jsonc",
		extends: ["jsonc/recommended-with-json"],
		rules: {
			"jsonc/sort-keys": [
				"warn",
				{
					pathPattern: "^$",
					order: ["$schema", "note", "schema_version", "source", "categories"],
				},
				{ pathPattern: "^categories$", order: { type: "asc" } },
                { pathPattern: ".*", hasProperties: ["name"], order: ["name", "category", "method", "energy", "sale_price", "*", "locations"] },
			],
		},
	},
	{
		files: ["**/recipes.json"],
		plugins: { jsonc },
		language: "jsonc/jsonc",
		extends: ["jsonc/recommended-with-json"],
		rules: {
			"jsonc/sort-keys": [
				"warn",
				{
					pathPattern: "^$",
					order: ["$schema", "note", "schema_version", "source", "recipes"],
				},
				{ pathPattern: "^recipes$", order: { type: "asc" } },
                { pathPattern: ".*", hasProperties: ["name"], order: ["name", "category", "course", "star_rating", "energy", "sale_price", "*", "ingredients"] },
			],
		},
	},
]);
