// Progressive enhancement: add a copy button to each code sample. Without
// JavaScript the code is still fully visible & selectable. No dependencies.

/** How long the "Copied" confirmation stays before the label resets. */
const CONFIRMATION_MS = 2000;

/**
 * Strip a leading shell prompt (`$ `) from each line so a copied command is
 * paste-ready. Whitespace is required after `$` so variables like `$HOME`
 * are untouched.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripPrompt(text) {
	return text
		.split("\n")
		.map((line) => line.replace(/^\$\s+/, ""))
		.join("\n");
}

/**
 * Copy text with the async Clipboard API, falling back to a temporary
 * textarea where it is unavailable (for example, an insecure context).
 *
 * @param {string} text
 * @returns {Promise<boolean>} whether the copy succeeded
 */
async function copyText(text) {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fall through to the textarea path.
		}
	}
	const area = document.createElement("textarea");
	area.value = text;
	area.setAttribute("readonly", "");
	area.style.position = "fixed";
	area.style.opacity = "0";
	document.body.append(area);
	area.select();
	const ok = document.execCommand?.("copy") ?? false;
	area.remove();
	return ok;
}

function enhance(pre) {
	const wrapper = document.createElement("div");
	wrapper.className = "code-block";
	pre.replaceWith(wrapper);
	wrapper.append(pre);

	const button = document.createElement("button");
	button.type = "button";
	button.className = "copy-button";
	button.textContent = "Copy";
	button.setAttribute("aria-label", "Copy code to clipboard");

	const status = document.createElement("span");
	status.setAttribute("role", "status");
	status.className = "visually-hidden";
	status.style.cssText =
		"position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%)";
	wrapper.append(button, status);

	let timer;
	button.addEventListener("click", async () => {
		const ok = await copyText(stripPrompt(pre.textContent ?? ""));
		button.textContent = ok ? "Copied" : "Press Ctrl+C";
		status.textContent = ok ? "Copied to clipboard" : "Copy failed";
		clearTimeout(timer);
		timer = setTimeout(() => {
			button.textContent = "Copy";
			status.textContent = "";
		}, CONFIRMATION_MS);
	});
}

if (typeof document !== "undefined") {
	for (const pre of document.querySelectorAll(".code-sample pre")) {
		enhance(pre);
	}
}
