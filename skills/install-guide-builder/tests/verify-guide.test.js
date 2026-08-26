import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	MAX_COL_COMMAND_CHARS,
	MAX_FULL_COMMAND_CHARS,
	buildHtml,
	checkCallouts,
	checkCommands,
	checkStructure,
	findPlaceholders,
	stripTags,
	unescapeEntities,
	verify,
} from "../scripts/verify-guide.js";

const long = (n) => "x".repeat(n);

describe("buildHtml", () => {
	test("wraps body content in document furniture", () => {
		const html = buildHtml("<h2>Install Git</h2>", { css: "" });
		assert.match(html, /^<!DOCTYPE html>/);
		assert.match(html, /<html lang="en">/);
		assert.match(html, /<h2>Install Git<\/h2>/);
	});

	test("rewrites the accent declaration and substitutes the footer", () => {
		const html = buildHtml("<p>hi</p>", {
			css: ":root { --accent: #1e40af; } @bottom-left { content: 'FOOTERTEXT' }",
			accent: "#0f766e",
			footer: "Team Setup",
		});
		assert.match(html, /--accent: #0f766e;/);
		assert.ok(!html.includes("#1e40af"));
		assert.match(html, /content: 'Team Setup'/);
		assert.ok(!html.includes("FOOTERTEXT"));
	});

	test("leaves every var(--accent) reference pointing at the new value", () => {
		const html = buildHtml("<p>hi</p>", {
			css: ":root { --accent: #1e40af; } a { color: var(--accent) } b { border-color: var(--accent) }",
			accent: "red",
		});
		assert.match(html, /--accent: red;/);
		assert.equal(html.match(/var\(--accent\)/g).length, 2);
	});

	test("substitutes every footer occurrence", () => {
		const html = buildHtml("<p>hi</p>", {
			css: "a { content: 'FOOTERTEXT' } b { content: 'FOOTERTEXT' }",
			footer: "Team Setup",
		});
		assert.equal(html.match(/Team Setup/g).length, 2);
	});

	test("strips html and body tags a caller left in the input", () => {
		const html = buildHtml(
			'<html lang="en"><body class="x"><p>hi</p></body></html>',
			{ css: "" }
		);
		assert.equal(html.match(/<body>/g).length, 1);
		assert.ok(!html.includes('<body class="x">'));
		assert.ok(!html.includes('<html lang="en"><body'));
	});

	test("defaults the footer and title when unspecified", () => {
		const html = buildHtml("<p>hi</p>", { css: "" });
		assert.match(html, /<title>Setup Guide<\/title>/);
	});

	test("reads the shipped stylesheet when no css is passed", () => {
		const html = buildHtml("<p>hi</p>", { accent: "#123456" });
		assert.match(html, /@page/);
		assert.match(html, /--accent: #123456;/);
		assert.ok(!html.includes("FOOTERTEXT"));
	});
});

describe("stripTags and unescapeEntities", () => {
	test("stripTags removes markup but keeps text", () => {
		assert.equal(stripTags("<p>Run <code>git init</code></p>"), "Run git init");
	});

	test("unescapeEntities restores the entities the house style emits", () => {
		assert.equal(
			unescapeEntities("a &lt;b&gt; &amp; &quot;c&quot;&nbsp;d"),
			'a <b> & "c" d'
		);
	});
});

describe("checkCommands", () => {
	test("passes a command that fits at full width", () => {
		const body = `<pre>${long(MAX_FULL_COMMAND_CHARS)}</pre>`;
		assert.deepEqual(checkCommands(body), []);
	});

	test("flags a command that overflows at full width", () => {
		const body = `<pre>${long(MAX_FULL_COMMAND_CHARS + 1)}</pre>`;
		const [problem] = checkCommands(body);
		assert.equal(problem.length, MAX_FULL_COMMAND_CHARS + 1);
		assert.equal(problem.limit, MAX_FULL_COMMAND_CHARS);
		assert.equal(problem.where, "full width");
	});

	test("applies the tighter column limit inside a table cell", () => {
		const line = long(MAX_COL_COMMAND_CHARS + 1);
		const body = `<table class="split"><tr><td class="mac"><pre>${line}</pre></td></tr></table>`;
		const [problem] = checkCommands(body);
		assert.equal(problem.where, "column");
		assert.equal(problem.limit, MAX_COL_COMMAND_CHARS);
	});

	test("returns to the full-width limit after the cell closes", () => {
		const line = long(MAX_COL_COMMAND_CHARS + 1);
		const body = `<td><pre>short</pre></td><pre>${line}</pre>`;
		assert.deepEqual(checkCommands(body), []);
	});

	test("measures the command a reader actually copies, not the markup", () => {
		// The markup is long; the command itself is not.
		const body = `<pre><code class="language-bash">brew install php</code></pre>`;
		assert.deepEqual(checkCommands(body), []);
	});

	test("counts an escaped character as the one character it becomes", () => {
		const body = `<pre>${"&gt;".repeat(MAX_FULL_COMMAND_CHARS)}</pre>`;
		assert.deepEqual(checkCommands(body), []);
	});

	test("checks each line of a multi-line block", () => {
		const body = `<pre>ok\n${long(MAX_FULL_COMMAND_CHARS + 5)}\nok</pre>`;
		assert.equal(checkCommands(body).length, 1);
	});

	test("ignores trailing whitespace", () => {
		const body = `<pre>${long(MAX_FULL_COMMAND_CHARS)}     </pre>`;
		assert.deepEqual(checkCommands(body), []);
	});

	test("truncates the preview of a very long line", () => {
		const [problem] = checkCommands(`<pre>${long(200)}</pre>`);
		assert.ok(problem.text.endsWith("..."));
		assert.equal(problem.text.length, 73);
	});
});

describe("checkCallouts", () => {
	test("measures callout words as a share of the document", () => {
		const body =
			"<p>one two three four five six seven eight nine ten</p>" +
			'<div class="note">eleven twelve</div>';
		const result = checkCallouts(body);
		assert.equal(result.total, 12);
		assert.equal(result.callout, 2);
		assert.ok(Math.abs(result.percent - 16.67) < 0.01);
	});

	test("counts a nested div as part of its callout, not past it", () => {
		const body =
			'<div class="warn">a <div class="inner">b</div> c</div><p>d</p>';
		const result = checkCallouts(body);
		assert.equal(result.callout, 3);
		assert.equal(result.total, 4);
	});

	test("recognises all four callout kinds", () => {
		const body = ["note", "warn", "stop", "ok"]
			.map((k) => `<div class="${k}">word</div>`)
			.join("");
		const result = checkCallouts(body);
		assert.equal(result.boxes.length, 4);
		assert.deepEqual(
			result.boxes.map((b) => b.kind).sort(),
			["note", "ok", "stop", "warn"]
		);
	});

	test("does not match a class that merely starts with a callout name", () => {
		const result = checkCallouts('<div class="notebook">a b c</div>');
		assert.equal(result.boxes.length, 0);
	});

	test("sorts boxes largest first, so the report names the worst offender", () => {
		const body =
			'<div class="note">one</div><div class="warn">one two three</div>';
		const [first] = checkCallouts(body).boxes;
		assert.equal(first.words, 3);
		assert.equal(first.kind, "warn");
	});

	test("reports zero percent for an empty document rather than dividing by zero", () => {
		const result = checkCallouts("");
		assert.equal(result.percent, 0);
		assert.equal(result.total, 0);
	});
});

describe("findPlaceholders", () => {
	test("finds bracketed and braced placeholders", () => {
		const found = findPlaceholders(
			"<p>[TODO] and {{name}} and XXXX and [COURSE NUMBER]</p>"
		);
		assert.equal(found.length, 4);
		assert.ok(found.includes("[TODO]"));
		assert.ok(found.includes("{{name}}"));
		assert.ok(found.includes("[COURSE NUMBER]"));
	});

	test("does not flag ordinary prose or short bracketed text", () => {
		assert.deepEqual(findPlaceholders("<p>Press [y] to continue.</p>"), []);
	});
});

describe("checkStructure", () => {
	const step = (title, extra = "") =>
		`<h2>${title}</h2><table class="split"><tr><td>steps</td></tr></table>${extra}`;

	test("fails an install step with no Done when check", () => {
		const { failures } = checkStructure(step("Install Git"));
		assert.equal(failures.length, 1);
		assert.match(failures[0], /Install steps with no 'Done when' check/);
		assert.match(failures[0], /Install Git/);
	});

	test("accepts a step that carries a done callout", () => {
		const body = step("Install Git", '<div class="done"><b>Done when</b> ...</div>');
		assert.deepEqual(checkStructure(body).failures, []);
	});

	test('accepts a step whose text says "Done when" without the class', () => {
		const body = step("Install Git", "<p>Done when the version prints.</p>");
		assert.deepEqual(checkStructure(body).failures, []);
	});

	test("skips sections that are the check, or have nothing to install", () => {
		const body = [
			step("Before you begin"),
			step("Check your work"),
			step("When it goes wrong"),
			step("Appendix: shell basics"),
			step("Verify your install"),
		].join("");
		assert.deepEqual(checkStructure(body).failures, []);
	});

	test("ignores a section with no platform-split table", () => {
		const body = "<h2>Introduction</h2><p>Welcome.</p>";
		assert.deepEqual(checkStructure(body).failures, []);
	});

	test("advises on troubleshooting entries with no error text", () => {
		const body =
			'<div class="sym">The editor will not open</div>' +
			'<div class="sym"><code>command not found: git</code></div>';
		const { advisories, failures } = checkStructure(body);
		assert.deepEqual(failures, []);
		assert.equal(advisories.length, 1);
		assert.match(advisories[0], /^1 of 2 troubleshooting entries/);
	});

	test("stays quiet when every troubleshooting entry names its error", () => {
		const body = '<div class="sym"><code>EACCES</code></div>';
		assert.deepEqual(checkStructure(body).advisories, []);
	});

	test("fails on punctuation the house style does not use", () => {
		const { failures } = checkStructure("<p>a — b – c · d</p>");
		assert.equal(failures.length, 3);
		assert.ok(failures.some((f) => /em dash/.test(f)));
		assert.ok(failures.some((f) => /en dash/.test(f)));
		assert.ok(failures.some((f) => /middot/.test(f)));
	});

	test("counts every occurrence of a banned character", () => {
		const { failures } = checkStructure("<p>a — b — c</p>");
		assert.match(failures[0], /Found 2 em dash/);
	});

	test("does not read banned punctuation out of markup it stripped", () => {
		const body = '<p title="a — b">clean</p>';
		assert.deepEqual(checkStructure(body).failures, []);
	});
});

describe("verify", () => {
	test("passes a clean guide", () => {
		const body =
			"<h2>Install Git</h2>" +
			'<table class="split"><tr><td><pre>brew install git</pre></td></tr></table>' +
			'<div class="done"><b>Done when</b> git --version prints a number.</div>';
		const { ok, report } = verify(body);
		assert.equal(ok, true);
		assert.match(report, /Commands: all fit on one line/);
		assert.match(report, /Clean\./);
	});

	test("fails and explains a command that will break on copy", () => {
		const body = `<pre>${long(120)}</pre>`;
		const { ok, report } = verify(body);
		assert.equal(ok, false);
		assert.match(report, /COMMANDS THAT WILL BREAK ON COPY {2}\(1\)/);
		assert.match(report, /Fix the items above/);
	});

	test("fails on callout bloat and names the biggest boxes", () => {
		const body = '<p>one two three</p><div class="warn">four five six</div>';
		const { ok, report } = verify(body);
		assert.equal(ok, false);
		assert.match(report, /<-- over budget/);
		assert.match(report, /\.warn/);
	});

	test("stays under budget at exactly ten percent", () => {
		const body =
			`<p>${Array.from({ length: 90 }, (_, i) => `w${i}`).join(" ")}</p>` +
			`<div class="note">${Array.from({ length: 10 }, (_, i) => `c${i}`).join(" ")}</div>`;
		const { report } = verify(body);
		assert.ok(!report.includes("over budget"));
	});

	test("reports placeholders without failing the build", () => {
		const body = "<p>Contact [INSTRUCTOR EMAIL] with questions.</p>";
		const { ok, report } = verify(body);
		assert.equal(ok, true);
		assert.match(report, /Placeholders left: 1/);
		assert.match(report, /INSTRUCTOR EMAIL/);
	});

	test("advisories alone do not fail the build", () => {
		const body = '<div class="sym">The editor will not open</div>';
		const { ok, report } = verify(body);
		assert.equal(ok, true);
		assert.match(report, /note: 1 of 1 troubleshooting entries/);
	});

	test("always closes with the checks a human still has to make", () => {
		const { report } = verify("<p>anything</p>");
		assert.match(report, /cross-references point at steps that exist/);
		assert.match(report, /verified, not remembered/);
	});
});
