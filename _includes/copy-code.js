// Progressive enhancement: add a copy-to-clipboard button to every code block.
// Loaded into the shared `js` bundle from foundation.njk, so it runs on the
// landing page, the per-skill detail pages, and the rendered SKILL.md prose.

/** Build a decorative Font Awesome icon span. */
function icon(classes) {
	const span = document.createElement("span");
	span.className = classes;
	span.setAttribute("aria-hidden", "true");
	return span;
}

/** Set the button's contents from a (possibly null) icon and optional label. */
function setState(button, iconClasses, label) {
	button.replaceChildren();
	if (iconClasses) button.append(icon(iconClasses));
	if (label) button.append(label);
}

/**
 * Strip a leading shell prompt (`$ `) from each line so copied commands are
 * paste-ready. Requires whitespace after `$` to avoid touching shell variables
 * like `$VAR` or `${CLAUDE_PLUGIN_ROOT}`.
 *
 * @param {string} text
 * @returns {string}
 */
function stripPrompt(text) {
	return text
		.split("\n")
		.map((line) => line.replace(/^\$\s+/, ""))
		.join("\n");
}

/**
 * Copy text to the clipboard, falling back to a temporary textarea + execCommand
 * when the async Clipboard API is unavailable (e.g. non-secure contexts). Both
 * paths copy the exact string passed in, so normalization stays consistent.
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
			/* fall through to the textarea fallback */
		}
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	textarea.style.pointerEvents = "none";
	document.body.append(textarea);
	textarea.select();
	const ok = document.execCommand?.("copy") ?? false;
	textarea.remove();
	return ok;
}

// The folder-structure tree (`.skill-tree`) is a display block, not a
// copy-and-run snippet — an ASCII tree pastes nowhere useful — so it opts out
// of the copy affordance.
for (const pre of document.querySelectorAll("pre:not(.skill-tree)")) {
	// Wrap the <pre> so the button can be absolutely positioned against it.
	const wrapper = document.createElement("div");
	wrapper.className = "code-block";
	pre.replaceWith(wrapper);
	wrapper.append(pre);

	const button = document.createElement("button");
	button.type = "button";
	button.className = "copy-button";
	button.setAttribute("aria-label", "Copy code to clipboard");
	setState(button, "fa-regular fa-copy", null);
	wrapper.append(button);

	let resetTimer;
	button.addEventListener("click", async () => {
		const ok = await copyText(stripPrompt(pre.innerText));
		button.classList.toggle("copied", ok);
		setState(button, ok ? "fa-solid fa-check" : null, ok ? "Copied" : "Press ⌘C");

		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => {
			button.classList.remove("copied");
			setState(button, "fa-regular fa-copy", null);
		}, 2000);
	});
}
