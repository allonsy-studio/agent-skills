# House style

## Voice

Plain, direct, warm. Second person. Contractions. American spellings.

Explain *why* a step matters when the reason changes what the reader does. "Close every
terminal, because a program only learns the PATH when it starts" earns its words. "Click
Next to proceed" does not.

Never imply a step is easy. "Simply", "just", and "obviously" all tell a stuck reader the
problem is them. Say how long something takes instead, which is the information they
actually wanted.

**Punctuation:** no em dashes, no en dashes. Restructure the sentence: split it, use a
comma, use a colon, use parentheses. Separators in headings, footers and metadata lines
are pipes with spaces around them, not middots.

## Structure

```text
Cover            Course or team, title, what is covered, per-platform time estimates,
                 contents list, one line on when to do it
Step 0           What you're installing (table), prerequisites, glossary if first-time,
                 machine check, filename extensions, project folder
Steps 1..n       One per tool, in dependency order, each ending in "Done when:"
Check your work  Every verify command in one block, expected output table, and one
                 end-to-end test that proves the whole chain
When it goes wrong  Entries titled with error text
Appendix         Paths table, how to ask for help
```

Number the guide, not the layers. A guide with no editor still starts at step 1.

## Time estimates

Put one on every step heading and on the cover. Readers use them to decide whether to
start now, and an honest 20 minutes is better received than an optimistic 5.

Where platforms differ a lot, give both: `Windows 20 min | macOS 15 min`.

## The two-column pattern

Platform-specific content goes in a two-column table, one platform per column, each cell
self-contained. Do not interleave at the sentence level ("on Windows do X, on macOS do
Y") — readers follow the wrong branch.

Let the columns be unequal. When macOS is three steps and Windows is seven, the white
space tells the Mac reader they are done. That is useful information, not a layout bug.

With three platforms, two columns still read better than three narrow ones. Put the two
most-used side by side and give the third its own short section, or use three columns only
for short content like verify commands.

## Verification

Every step ends with a **Done when:** line naming observable output. Not "it should work".
The actual string.

The final check should be **end to end**, not a list of version numbers. A three-line
script that opens a database through the language you installed proves the runtime, its
PATH, its config file and its driver in one command. Six `--version` calls prove six
programs exist.

Give expected output as a table with a column per platform. Explain placeholder notation
(`x` means any number) and say what to do when a number does not match, since "wrong
version" is otherwise a dead end.

## Troubleshooting

Title every entry with **the error text the reader is looking at**, in code formatting.
People search for what is on their screen, not for "PATH issues".

Order by frequency, not severity. Put "you didn't restart your terminal" first, because it
is the answer most of the time.

Cover per entry: what it means in one line, then the fixes in likelihood order, then what
to do if none worked. Tag entries by platform when they differ.

Always include a final "none of the above" entry with concrete instructions for asking for
help: the screenshot key combination for each platform, what to capture (the whole window,
not the red text), and what to include (step number, platform).

## Callouts

Callouts hold **under about 10% of the words**. Past that the page becomes a wall of
colored boxes and readers skip all of them, including the one that mattered.

| Class | Use for |
|---|---|
| `.stop` | Something that will break the install if missed |
| `.warn` | A real but survivable hazard |
| `.note` | Context that is useful but not urgent |
| `.ok` | Expected output, a confirmation |
| `.done` | The per-step "Done when" line |

If a box exceeds roughly two short paragraphs, it should be a heading with ordinary prose
under it. Keep the rule in the box and move the explanation out.

## HTML classes

Write body content only. `build-guide.js` supplies the stylesheet and page furniture.

```html
<section class="cover">
  <div class="eyebrow">Org | Term</div>
  <h1>Title</h1>
  <p class="sub">Subtitle<br><span class="sub-tools">Tool | Tool | Tool</span></p>
  <div class="rule"></div>
  <div class="platforms">
    <div class="plat win"><h3>Windows</h3><p>Time and framing.</p></div>
    <div class="plat mac"><h3>macOS</h3><p>Time and framing.</p></div>
  </div>
  <div class="toc">
    <h3>What's in here</h3>
    <ol start="0"><li>Name <span class="t">| detail</span></li></ol>
  </div>
  <div class="meta">When to do this.</div>
</section>

<h2><span class="num">1</span>Tool<span class="time">10 minutes</span></h2>
<p class="lede">One line on what this is and why it is here.</p>

<table class="split">
  <thead><tr><th class="win">Windows</th><th class="mac">macOS</th></tr></thead>
  <tbody><tr>
    <td class="win"><ol><li>Step</li></ol></td>
    <td class="mac"><ol><li>Step</li></ol></td>
  </tr></tbody>
</table>

<div class="done"><b>Done when:</b> <code>tool --version</code> prints a version.</div>

<table class="ref">
  <thead><tr><th>Column</th><th>Column</th></tr></thead>
  <tbody><tr><td>Cell</td><td>Cell</td></tr></tbody>
</table>

<div class="warn"><span class="lbl">Short label</span><p>One or two paragraphs.</p></div>

<div class="tsq">
  <div class="sym"><span class="badge both">Both</span><code>error text here</code></div>
  <p>What it means, then the fixes.</p>
</div>

<hr class="sec">
```

Badges: `.badge.win`, `.badge.mac`, `.badge.linux`, `.badge.both`.
Add `class="flow"` to a `.note` that is long enough to need to break across pages.

## Commands must survive copy and paste

A long command inside a narrow table column wraps, and a reader copying it out of the PDF
gets a broken command with a newline in the middle. This is the most damaging formatting
bug in this kind of document because it looks fine on the page.

Options, in order of preference:

1. Put the command in a full-width block outside the two-column table.
2. Send the reader to the vendor's page to copy it, and show a truncated version for
   recognition. Correct for `curl | bash` installers anyway, which should be copied from
   the vendor rather than from a PDF nobody can verify.
3. Shorten the command.

`build-guide.js` checks every code block and names the offenders. Fix what it reports.

Include one standing note near the front: every command is a single line even where the
page wraps it, and Enter comes only at the end.
