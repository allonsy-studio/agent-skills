import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

import js from "@eslint/js";
import json from "@eslint/json";
import jsonc from "eslint-plugin-jsonc";
import markdown from "@eslint/markdown";
import css from "@eslint/css";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default defineConfig([
	globalIgnores([
		"**/node_modules/**",
		"**/dist/**",
		"**/coverage/**",
		".yarn/**",
		".cache/**",
		"CHANGELOG.md",
	]),
	{
		files: ["**/*.js"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: { globals: globals.node },
	},
	{
		// Browser-side scripts: skill dashboard templates and the client
		// enhancements in `_includes/` that get bundled into each page.
		files: ["**/templates/*.js", "_includes/**/*.js"],
		plugins: { js },
		extends: ["js/recommended"],
		languageOptions: { globals: globals.browser },
	},
	{
		files: ["**/(!package).json"],
		plugins: { json },
		language: "json/json",
		extends: ["json/recommended"],
		rules: {
			"json/sort-keys": [
				"warn",
				"asc",
				{
					natural: true,
				}
			],
		},
	},
	{
		files: ["**/package.json"],
		plugins: { jsonc },
		language: "jsonc/jsonc",
		extends: ["jsonc/recommended-with-json"],
		rules: {
			"jsonc/sort-keys": [
				"warn",
				{
					pathPattern: "^$",
					order: ["$schema", "private", "publishConfig", "name", "version", "description", "license", "author", "maintainers", "contributors", "homepage", "funding", "repository", "bugs", "type", "exports", "main", "module", "browser", "man", "preferGlobal", "bin", "files", "directories", "scripts", "config", "sideEffects", "types", "typings", "workspaces", "resolutions", "dependencies", "bundleDependencies", "bundledDependencies", "peerDependencies", "peerDependenciesMeta", "optionalDependencies", "devDependencies", "keywords", "engines", "engineStrict", "os", "cpu", "*", "packageManager"],
				},
				{ pathPattern: "^repository$", order: ["type", "url", "directory"] },
				{ pathPattern: "^vague$", order: { type: "asc" } },
				{ pathPattern: "^exports$", order: ["."] },
				{ pathPattern: ".*", order: { type: "asc" } },
			],
		},
	},
	{
		files: ["**/*.md"],
		plugins: { markdown },
		language: "markdown/gfm",
		extends: ["markdown/recommended"],
		rules: {
			"markdown/no-missing-label-references": "off",
		},
	},
	{
		files: ["**/*.css"],
		plugins: { css },
		language: "css/css",
		extends: ["css/recommended"],
		rules: {
			"css/use-baseline": ["warn", { available: "newly" }],
			"css/no-important": "off",
			// Custom properties are declared in `_includes/foundation.njk`'s inline
			// <style> block (injected per-page from theme data), so the linter
			// can't statically trace them from the .css files alone. Treat
			// var(--unknown) references as valid; we still catch typo'd properties
			// and bad enum values.
			"css/no-invalid-properties": ["error", { allowUnknownVariables: true }],
		},
	},
	eslintConfigPrettier,
]);
