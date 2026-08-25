import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

import { MANAGERS, TOOLS, resolve } from "../scripts/order-tools.js";
import previewData from "../preview/index.11tydata.js";

const skillRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(skillRoot, "..", "..");

const guide = JSON.parse(
	readFileSync(join(skillRoot, "preview", "example-guide.json"), "utf8")
);

const data = await previewData({ eleventy: { env: { root: repoRoot } } });

/**
 * Build a throwaway repo root holding just the file the data layer reads, so
 * the failure paths can be exercised without touching the real example.
 *
 * @param {object} content
 * @returns {string} the fake root
 */
function fixtureRoot(content) {
	const root = mkdtempSync(join(tmpdir(), "install-guide-preview-"));
	const dir = join(root, "skills", "install-guide-builder", "preview");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, "example-guide.json"),
		JSON.stringify(content),
		"utf8"
	);
	return root;
}

describe("the example guide", () => {
	test("only describes tools the shipped dependency graph knows", () => {
		for (const name of Object.keys(guide.tools)) {
			assert.ok(
				TOOLS[name],
				`example-guide.json describes "${name}", which is not in scripts/order-tools.js`
			);
		}
	});

	test("carries content for every tool the resolver pulls in", () => {
		const { ordered } = resolve(guide.selected, "all");
		for (const name of ordered) {
			assert.ok(
				guide.tools[name],
				`resolving the example selection needs "${name}", which has no content`
			);
		}
	});

	test("never writes steps for a platform the graph says a tool has no place on", () => {
		for (const [name, tool] of Object.entries(guide.tools)) {
			const supported = TOOLS[name][3];
			if (supported.includes("*")) continue;
			for (const os of Object.keys(tool.steps)) {
				assert.ok(
					supported.includes(os),
					`${name} has ${os} steps, but the graph limits it to ${supported.join(", ")}`
				);
			}
		}
	});

	test("gives every platform it has steps for a way to check the work", () => {
		// Every install step ends with a check that names observable output.
		// This is the property the whole skill is built around.
		for (const [name, tool] of Object.entries(guide.tools)) {
			for (const os of Object.keys(tool.steps)) {
				const check = tool.verify?.[os] ?? tool.verify?.["*"];
				assert.ok(check, `${name} has ${os} steps but no ${os} verify`);
				assert.ok(check.cmd, `${name}/${os} verify has no command`);
				assert.ok(
					check.expect,
					`${name}/${os} verify does not say what to expect`
				);
			}
		}
	});

	test("titles every troubleshooting entry with the reader's error text", () => {
		for (const [name, tool] of Object.entries(guide.tools)) {
			for (const entry of tool.troubleshooting ?? []) {
				assert.ok(entry.sym, `${name} has a troubleshooting entry with no symptom`);
				assert.ok(entry.fix, `${name}: "${entry.sym}" has no fix`);
				assert.ok(
					entry.platforms?.length > 0,
					`${name}: "${entry.sym}" names no platform`
				);
				for (const os of entry.platforms) {
					assert.ok(
						guide.platforms.includes(os),
						`${name}: "${entry.sym}" names ${os}, which the guide does not cover`
					);
				}
			}
		}
	});

	test("only claims a runtime is manager-supplied when a manager manages it", () => {
		for (const [name, tool] of Object.entries(guide.tools)) {
			if (!tool.managedNote) continue;
			assert.ok(
				MANAGERS[name],
				`${name} carries a managedNote but no version manager provides it`
			);
		}
	});

	test("offers every tool it says the reader selected", () => {
		for (const name of guide.selected) {
			assert.ok(guide.tools[name], `selected "${name}" has no content`);
		}
	});
});

describe("preview data", () => {
	test("orders tools exactly as the shipped resolver does", () => {
		const { ordered } = resolve(guide.selected, "all");
		assert.deepEqual(
			data.tools.map((tool) => tool.id),
			ordered
		);
	});

	test("numbers steps from one, in order", () => {
		assert.deepEqual(
			data.tools.map((tool) => tool.step),
			data.tools.map((_, i) => i + 1)
		);
	});

	test("puts a prerequisite before everything that needs it", () => {
		const order = data.tools.map((tool) => tool.id);
		for (const tool of data.tools) {
			for (const pre of tool.requires) {
				assert.ok(
					order.indexOf(pre) < order.indexOf(tool.id),
					`${pre} must come before ${tool.id}`
				);
			}
		}
	});

	test("offers only chosen tools as checkboxes, never prerequisites", () => {
		assert.deepEqual(
			data.choices.map((tool) => tool.id).sort(),
			[...guide.selected].sort()
		);
		assert.ok(data.choices.every((tool) => !tool.added));
	});

	test("says which tool each added prerequisite is there for", () => {
		for (const tool of data.tools.filter((t) => t.added)) {
			assert.ok(
				tool.addedFor.length > 0,
				`${tool.id} was added but names nothing that needs it`
			);
			for (const dependent of tool.addedFor) {
				assert.ok(TOOLS[dependent][2].includes(tool.id));
			}
		}
	});

	test("marks a runtime as supplied by the manager the reader picked", () => {
		const node = data.tools.find((tool) => tool.id === "node");
		assert.equal(node.managedBy, "nvm");
		assert.ok(node.managedNote, "a superseded runtime has to say why");

		const nvm = data.tools.find((tool) => tool.id === "nvm");
		assert.equal(nvm.managedBy, null);
	});

	test("renders the inline subset and nothing else", () => {
		const steps = data.tools.flatMap((tool) =>
			Object.values(tool.steps).flat()
		);
		assert.ok(
			steps.some((step) => step.do.includes("<code>")),
			"backticks should become <code>"
		);
		assert.ok(
			steps.some((step) => step.do.includes("<strong>")),
			"** should become <strong>"
		);
		// The template prints this prose with `| safe`, so only those two tags
		// may ever reach the page.
		for (const step of steps) {
			assert.ok(!/<(?!\/?(?:code|strong)>)/.test(step.do), step.do);
		}
	});

	test("escapes markup in the prose before rendering that subset", async () => {
		const root = fixtureRoot({
			...guide,
			tools: {
				...guide.tools,
				docker: {
					...guide.tools.docker,
					steps: {
						...guide.tools.docker.steps,
						macos: [{ do: "Beware <script>alert(1)</script> & `<b>x</b>`" }],
					},
				},
			},
		});
		const built = await previewData({ eleventy: { env: { root } } });
		const [step] = built.tools.find((tool) => tool.id === "docker").steps.macos;

		assert.ok(!step.do.includes("<script>"), step.do);
		assert.ok(step.do.includes("&lt;script&gt;"));
		assert.ok(step.do.includes("&amp;"));
		// Escaping happens first, so markup inside backticks stays visible text
		// rather than becoming live tags.
		assert.ok(step.do.includes("<code>&lt;b&gt;x&lt;/b&gt;</code>"));
	});

	test("keeps troubleshooting entries only for platforms the guide covers", () => {
		for (const tool of data.tools) {
			for (const entry of tool.troubleshooting) {
				assert.ok(entry.platforms.length > 0);
				assert.ok(entry.platforms.every((os) => guide.platforms.includes(os)));
			}
		}
	});

	test("refuses an example naming a tool the graph does not have", async () => {
		const root = fixtureRoot({
			...guide,
			tools: { ...guide.tools, cobol: { blurb: "x", steps: {}, verify: {} } },
		});
		await assert.rejects(
			previewData({ eleventy: { env: { root } } }),
			/not in scripts\/order-tools\.js: cobol/
		);
	});

	test("refuses an example missing a prerequisite the resolver adds", async () => {
		const tools = { ...guide.tools };
		delete tools.homebrew;
		const root = fixtureRoot({ ...guide, tools });
		await assert.rejects(
			previewData({ eleventy: { env: { root } } }),
			/missing content for resolved prerequisites: homebrew/
		);
	});
});
