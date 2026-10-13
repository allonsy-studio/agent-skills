import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { JSDOM } from "jsdom";

import { CORE_DIR } from "../scripts/lib/layers.js";
import { stripPrompt } from "../templates/core/src/assets/js/copy-code.js";

describe("stripPrompt", () => {
	test("removes a leading shell prompt so a copied command is paste-ready", () => {
		assert.equal(stripPrompt("$ npm install\n$ npm test"), "npm install\nnpm test");
	});

	test("leaves variables and plain text alone", () => {
		assert.equal(stripPrompt("$HOME/bin\necho $PATH"), "$HOME/bin\necho $PATH");
	});
});

describe("copy button enhancement", () => {
	const source = readFileSync(path.join(CORE_DIR, "src/assets/js/copy-code.js"), "utf8");

	function page(clipboard) {
		const dom = new JSDOM(
			'<figure class="code-sample"><pre><code>$ example-cli --help</code></pre></figure>',
			{ runScripts: "outside-only" }
		);
		const { window } = dom;
		Object.defineProperty(window.navigator, "clipboard", { value: clipboard, configurable: true });
		window.eval(source.replace(/^export function/m, "function"));
		return window;
	}

	test("adds a labeled button & a status region, and copies without the prompt", async () => {
		const copied = [];
		const window = page({ writeText: async (text) => copied.push(text) });
		const button = window.document.querySelector(".copy-button");
		assert.equal(button.getAttribute("aria-label"), "Copy code to clipboard");
		assert.equal(button.type, "button");
		button.click();
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.deepEqual(copied, ["example-cli --help"]);
		assert.equal(button.textContent, "Copied");
		assert.equal(window.document.querySelector("[role=status]").textContent, "Copied to clipboard");
	});

	test("says so when copying fails", async () => {
		const window = page({ writeText: async () => Promise.reject(new Error("denied")) });
		const button = window.document.querySelector(".copy-button");
		button.click();
		await new Promise((resolve) => setTimeout(resolve, 10));
		assert.equal(button.textContent, "Press Ctrl+C");
	});
});
