#!/usr/bin/env node
/**
 * Resolve selected tools into install order, adding implied prerequisites.
 *
 *     node scripts/order-tools.js node python php --os macos
 *     node scripts/order-tools.js --list
 *
 * Prints the ordered steps, marks anything added rather than chosen, and warns about
 * combinations that conflict. Use it instead of ordering by hand when more than about
 * four tools are selected, since the implied prerequisites are easy to miss.
 *
 * The graph lives in references/dependency-rules.md. This is that graph, executable.
 */

import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

/**
 * The dependency graph. Every entry is `[layer, label, requires, platforms]`,
 * where `platforms` of `["*"]` means the tool applies everywhere.
 *
 * @type {Record<string, [number, string, string[], string[]]>}
 */
export const TOOLS = {
	"xcode-clt": [0, "Xcode Command Line Tools", [], ["macos"]],
	buildtools: [0, "Windows Build Tools", [], ["windows"]],
	"apt-update": [0, "Refresh package lists", [], ["linux"]],

	homebrew: [1, "Homebrew", ["xcode-clt"], ["macos", "linux"]],
	winget: [1, "winget", [], ["windows"]],
	scoop: [1, "Scoop", [], ["windows"]],

	vscode: [2, "VS Code", [], ["*"]],
	zed: [2, "Zed", [], ["*"]],
	cursor: [2, "Cursor", [], ["*"]],
	neovim: [2, "Neovim", [], ["*"]],

	git: [3, "Git", ["vscode"], ["*"]],
	gh: [3, "GitHub CLI", ["git"], ["*"]],

	nvm: [4, "nvm", [], ["*"]],
	fnm: [4, "fnm", [], ["*"]],
	volta: [4, "Volta", [], ["*"]],
	uv: [4, "uv", [], ["*"]],
	pyenv: [4, "pyenv", ["homebrew"], ["macos", "linux"]],
	rustup: [4, "rustup", [], ["*"]],
	sdkman: [4, "SDKMAN", [], ["macos", "linux"]],
	mise: [4, "mise", [], ["*"]],

	node: [5, "Node.js", [], ["*"]],
	python: [5, "Python", [], ["*"]],
	php: [5, "PHP", ["homebrew"], ["*"]],
	ruby: [5, "Ruby", [], ["*"]],
	go: [5, "Go", [], ["*"]],
	java: [5, "Java", [], ["*"]],
	rust: [5, "Rust", ["rustup"], ["*"]],
	cpp: [5, "C++", ["xcode-clt"], ["*"]],

	docker: [6, "Docker", [], ["*"]],
	postgres: [6, "PostgreSQL", ["homebrew"], ["*"]],
	mysql: [6, "MySQL", ["homebrew"], ["*"]],
	redis: [6, "Redis", ["homebrew"], ["*"]],
	sqlite: [6, "SQLite", [], ["*"]],
};

/** A runtime and the managers that can provide it. */
export const MANAGERS = {
	node: ["nvm", "fnm", "volta", "mise"],
	python: ["uv", "pyenv", "mise"],
	ruby: ["mise", "rbenv"],
	java: ["sdkman", "mise"],
};

export const DEFAULT_MANAGER = {
	node: "nvm",
	python: "uv",
	ruby: "mise",
	java: "sdkman",
};

export const PLATFORMS = ["macos", "windows", "linux", "all"];

/** Catalog order, used as the final ordering tiebreak so output is deterministic. */
const CATALOG_ORDER = Object.keys(TOOLS);

/**
 * Does `tool` apply on `osName`? Unknown tools apply everywhere, so a
 * hand-added entry is never silently dropped.
 *
 * @param {string} tool
 * @param {string} osName
 * @returns {boolean}
 */
function appliesTo(tool, osName) {
	if (osName === "all") return true;
	const entry = TOOLS[tool];
	if (!entry) return true;
	return entry[3].includes("*") || entry[3].includes(osName);
}

/**
 * Expand a selection into full install order, pulling in prerequisites
 * transitively and dropping anything that does not apply to the target OS.
 *
 * @param {string[]} selected known tool keys, in the order the reader picked them
 * @param {string} osName one of PLATFORMS
 * @returns {{ ordered: string[], added: Set<string> }}
 */
export function resolve(selected, osName) {
	const chosen = new Set(selected);
	const added = new Set();

	// Pull in prerequisites, transitively. A prerequisite that does not apply to
	// the target OS is skipped rather than added and then filtered: Homebrew is a
	// prerequisite of PHP on macOS, but on Windows PHP has no prerequisite at all.
	let changed = true;
	while (changed) {
		changed = false;
		for (const name of [...chosen]) {
			for (const pre of TOOLS[name]?.[2] ?? []) {
				if (!TOOLS[pre]) continue;
				if (!appliesTo(pre, osName)) continue;
				if (chosen.has(pre)) continue;
				chosen.add(pre);
				added.add(pre);
				changed = true;
			}
		}
	}

	const candidates = [...chosen].filter((tool) => appliesTo(tool, osName));

	// Preferred order, ignoring dependencies: by layer, then by the reader's own
	// ordering, with prerequisites they did not ask for after the ones they did.
	// Catalog order breaks the remaining ties so the output is deterministic.
	const rank = (tool) => [
		TOOLS[tool]?.[0] ?? 9,
		selected.indexOf(tool) < 0 ? 99 : selected.indexOf(tool),
		CATALOG_ORDER.indexOf(tool),
	];
	const preferred = (a, b) => {
		const [al, ap, ac] = rank(a);
		const [bl, bp, bc] = rank(b);
		return al - bl || ap - bp || ac - bc;
	};

	// Then emit in dependency order, taking the most-preferred tool whose
	// prerequisites are already placed. Layer alone is not enough: Git and the
	// GitHub CLI share layer 3, so asking for `gh` must still put Git first even
	// though Git is the one the reader did not name.
	const blocking = new Map(
		candidates.map((tool) => [
			tool,
			new Set(
				(TOOLS[tool]?.[2] ?? []).filter((pre) => candidates.includes(pre))
			),
		])
	);

	const ordered = [];
	const remaining = [...candidates].sort(preferred);
	while (remaining.length > 0) {
		// A cycle would leave nothing unblocked; fall back to the preferred order
		// rather than looping forever. The catalog test rules cycles out.
		const index = remaining.findIndex(
			(tool) => blocking.get(tool).size === 0
		);
		const [next] = remaining.splice(index < 0 ? 0 : index, 1);
		ordered.push(next);
		for (const set of blocking.values()) set.delete(next);
	}

	return { ordered, added };
}

/**
 * Combinations that produce a contradictory or actively broken guide.
 *
 * @param {string[]} selected raw selection, including keys not in the catalog
 * @param {string} osName one of PLATFORMS
 * @returns {string[]}
 */
export function warnings(selected, osName) {
	const out = [];

	for (const [runtime, managers] of Object.entries(MANAGERS)) {
		if (!selected.includes(runtime)) continue;
		const picked = managers.filter((m) => selected.includes(m));
		if (picked.length === 0) {
			out.push(
				`${TOOLS[runtime][1]} selected with no version manager. Offer ` +
					`${DEFAULT_MANAGER[runtime]} and default to it. 'Install ${runtime}' ` +
					`and 'install ${runtime} via ${DEFAULT_MANAGER[runtime]}' are ` +
					`different documents.`
			);
		} else if (picked.length > 1) {
			out.push(
				`Two managers picked for ${runtime}: [${picked.join(", ")}]. Pick one, ` +
					`or the guide emits contradictory steps.`
			);
		}
	}

	const windowsInScope = osName === "windows" || osName === "all";
	if (selected.includes("nvm") && windowsInScope) {
		out.push(
			"nvm on Windows is coreybutler/nvm-windows, a separate project: " +
				"different syntax (`nvm install lts`, no double dash), `nvm use` needs " +
				"an admin terminal, and Node must be uninstalled first. Write the " +
				"Windows column from that project, not from nvm-sh docs."
		);
	}
	if (
		selected.includes("nvm") &&
		selected.includes("node") &&
		windowsInScope
	) {
		out.push(
			"nvm + Node.js both selected. On Windows an existing Node install is " +
				"what breaks nvm-windows. Emit the nvm step only, and add a line " +
				"telling readers to uninstall any Node they already have."
		);
	}
	if (selected.includes("uv") && selected.includes("python")) {
		out.push(
			"With uv selected, do NOT also send readers to python.org. uv installs " +
				"interpreters itself, and two Pythons is the top cause of 'works in " +
				"the terminal, not in my editor'."
		);
	}

	const runtimes = ["node", "python", "ruby", "java", "go"].filter((r) =>
		selected.includes(r)
	);
	if (runtimes.length >= 3 && !selected.includes("mise")) {
		out.push(
			`${runtimes.length} runtimes selected. Offer mise as a single ` +
				`replacement for the separate version-manager steps, and say what ` +
				`it costs: one more tool, and per-tool docs that assume you skipped it.`
		);
	}

	return out;
}

/**
 * The catalog listing printed by `--list` and by a bare invocation.
 *
 * @returns {string}
 */
export function formatCatalog() {
	const lines = ["Known tools, by layer:", ""];
	const layers = [...new Set(Object.values(TOOLS).map(([layer]) => layer))];
	for (const layer of layers.sort((a, b) => a - b)) {
		const names = Object.entries(TOOLS)
			.filter(([, entry]) => entry[0] === layer)
			.map(([key]) => key);
		lines.push(`  ${layer}: ${names.join(", ")}`);
	}
	lines.push("", "Managers group with their runtime:");
	for (const [runtime, managers] of Object.entries(MANAGERS)) {
		lines.push(
			`  ${runtime}: ${managers.join(", ")}  (default ${DEFAULT_MANAGER[runtime]})`
		);
	}
	return lines.join("\n");
}

/**
 * The install-order report.
 *
 * @param {string[]} selected raw selection, including keys not in the catalog
 * @param {string} osName one of PLATFORMS
 * @returns {string}
 */
export function formatReport(selected, osName) {
	const known = selected.filter((t) => TOOLS[t]);
	const { ordered, added } = resolve(known, osName);

	const lines = ["", `Install order  (os: ${osName})`, "=".repeat(52)];
	ordered.forEach((name, i) => {
		const [layer, label] = TOOLS[name];
		const mark = added.has(name) ? "  <- prerequisite, not chosen" : "";
		const n = String(i + 1).padStart(2, " ");
		lines.push(`  ${n}. ${label.padEnd(28, " ")}layer ${layer}${mark}`);
	});

	if (added.size > 0) {
		lines.push(
			"",
			"  Say in one line at each prerequisite step why the reader is " +
				"installing something they did not ask for."
		);
	}

	for (const warning of warnings(selected, osName)) {
		lines.push("", `  ! ${warning}`);
	}

	return `${lines.join("\n")}\n`;
}

const USAGE = `Usage: node scripts/order-tools.js [tools...] [--os macos|windows|linux|all]

  --os <platform>  target platform (default: all)
  --list           print the known tool keys and exit
  --help           show this message
`;

/**
 * @param {string[]} argv
 * @param {{ log?: (s: string) => void, error?: (s: string) => void }} [io]
 * @returns {number} process exit code
 */
export function main(argv, io = {}) {
	const log = io.log ?? console.log;
	const error = io.error ?? console.error;

	let parsed;
	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				os: { type: "string", default: "all" },
				list: { type: "boolean", default: false },
				help: { type: "boolean", default: false },
			},
		});
	} catch (err) {
		error(err.message);
		error(USAGE);
		return 2;
	}

	const { values, positionals } = parsed;

	if (values.help) {
		log(USAGE);
		return 0;
	}

	if (!PLATFORMS.includes(values.os)) {
		error(
			`Unknown --os "${values.os}". Choose one of: ${PLATFORMS.join(", ")}.`
		);
		return 2;
	}

	if (values.list || positionals.length === 0) {
		log(formatCatalog());
		return 0;
	}

	const unknown = positionals.filter((t) => !TOOLS[t]);
	if (unknown.length > 0) {
		error(`Not in the catalog: [${unknown.join(", ")}]`);
		error(
			"Add them to references/tool-catalog.md and to TOOLS here, or place " +
				"them by layer manually.\n"
		);
	}

	log(formatReport(positionals, values.os));
	return 0;
}

/* c8 ignore start -- CLI entry point, exercised through main() in tests */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main(process.argv.slice(2));
}
/* c8 ignore stop */
