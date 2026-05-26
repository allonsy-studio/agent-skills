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
		files: ["**/templates/*.js"],
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
		},
	},
	eslintConfigPrettier,
]);
