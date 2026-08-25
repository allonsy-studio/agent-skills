# The interactive web guide

A single self-contained HTML file. The reader picks their platform and checks the tools
they want; the page assembles the steps in dependency order and hides everything else.

Default voice: **early-career**. Someone who has used a terminal and installed things
before, but does not necessarily know why PATH breaks.

## Why a filter and not a static page

A static page covering ten tools makes every reader scroll past nine sections that do not
apply. The checkbox version turns the same content into a document that looks like it was
written for exactly one person. The cost is that the ordering logic has to be right, since
nobody can see what got skipped.

Two rules that follow from that:

- **Show the resolved order.** After the checkboxes, print the numbered list the page is
  about to render. The reader can see that Homebrew appeared because they picked PHP.
- **Say when something was added.** A prerequisite the reader did not check gets a small
  marker and a one-line reason. Silent additions read as bugs.

## Structure

```text
Header            title, one line on what the page does
Platforms         macOS | Windows | Linux, multi-select, remembered
Viewing toggle    which one the screen shows, appears only when 2+ are selected
Tool checkboxes   grouped by layer, version managers nested under their runtime
Resolved order    live list, updates as boxes change
Steps             one section per selected tool, in order, platform-filtered
Verification      every check command for the selected set, in one block
Troubleshooting   only entries belonging to selected tools
```

## Data shape

Keep the content in one JS object so the page is data-driven and extending it means adding
an entry, not editing markup.

```js
const TOOLS = {
  git: {
    label: "Git",
    layer: 3,
    requires: ["vscode"],
    platforms: ["macos", "windows", "linux"],
    blurb: "Version control. Install after your editor.",
    steps: {
      macos:   [ "...", "..." ],
      windows: [ "...", "..." ],
      linux:   [ "...", "..." ],
    },
    verify: { cmd: "git --version", expect: "a version number" },
    troubleshooting: [
      { sym: "'git' is not recognized", platforms: ["windows"], fix: "..." },
    ],
  },
};
```

Runtimes carry a `managers` array. Rendering a runtime whose manager is selected uses the
manager's steps instead of its own, and never both.

## Platforms: many for print, one on screen

Let the reader select **several platforms**, and print all of them. One PDF then covers a
whole team rather than one machine. But show **one at a time on screen**, because a page
with three platforms interleaved is unreadable and the reader only has one laptop in front
of them right now.

That means the DOM holds every selected platform's steps at all times, and CSS decides
what is visible:

```css
@media screen { [data-os] { display: none } [data-os].active-os { display: block } }
@media print  { [data-os] { display: block !important } .pfhead { display: block !important } }
```

Render one `.pf` block per platform inside each step, each with `data-os`, each carrying
its own numbered steps, commands, callouts and "Done when" line. JavaScript adds
`.active-os` to the blocks matching the current view.

Details worth getting right:

- **Platform headings appear only when more than one platform is selected.** With one, they
  are noise. Toggle a `single` class on the container.
- **Never allow zero platforms.** Refuse the last uncheck and say why, rather than
  rendering an empty page.
- **Progress ticks are per platform.** Key them `tool:os:index`, or ticking a step on macOS
  marks the Windows one too.
- **The verification round-up is also per platform**, since the commands differ (`py` vs
  `python3`, `cl` vs `g++`).
- **Troubleshooting entries can match several platforms.** Render each once, badged with
  every platform it applies to, rather than duplicating it per platform.
- **Say what print will do.** When more than one platform is selected, a line under the
  resolved order telling the reader that print includes all of them prevents the reasonable
  assumption that it prints what is on screen.

## Ordering

Same algorithm as `scripts/order-tools.js`:

1. Expand selections into prerequisites, transitively.
2. Deduplicate.
3. Drop anything that does not apply to the chosen platform.
4. Sort by layer, then by the order the boxes appear in the UI.
5. Number from 1.

Reimplement it in the page's JavaScript rather than importing anything. It is about thirty
lines and the page has to work as a single file with no build step.

## Behavior worth having

- **Remember the selection** in `localStorage` so a reader who closes the tab mid-install
  comes back to the same page. Wrap reads and writes in try/catch; private windows throw.
- **Progress checkboxes on the steps themselves**, also remembered. Setup takes more than
  one sitting and losing your place is the main reason people abandon it.
- **A copy button on every command block.** This is the web version's real advantage over
  the PDF, where a wrapped command breaks on copy. Copy the exact string, not the rendered
  text.
- **Deep link the selection**, for example `?os=macos&tools=git,node,uv`, so a team lead
  can send one link rather than instructions about which boxes to check.
- **Print stylesheet** that drops the controls and prints only the selected steps, so the
  page can become the handout without a separate PDF.

## What not to do

- Do not fetch the tool data from anywhere. One file, no network, no build step.
- Do not hide the platform switch behind auto-detection alone. Detect and preselect, but
  leave it visible and changeable; people set up machines they are not sitting at.
- Do not collapse the troubleshooting section by default. People arrive there by searching
  the page for their error text, and browser find does not search collapsed content in
  every browser.
