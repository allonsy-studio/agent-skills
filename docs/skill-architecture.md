# How to architect a skill

This is the design reference for building skills in this repo. It explains what a
skill _is_, how to structure one so an agent reliably discovers and uses it, and the
concrete budgets, conventions, and checks every skill must satisfy before it merges.

Read this **before** opening a [New Skill Proposal](https://github.com/Allons-y-Studio/agent-skills/issues/new?template=new_skill.yml)
or writing your first `SKILL.md`. For the mechanical steps (workspace setup, running
tests), see [`CONTRIBUTING.md`](../.github/CONTRIBUTING.md).

> **Why this matters.** A skill lives or dies on two things: whether the agent
> _triggers_ it at the right moment, and whether the instructions are _lean and
> specific_ enough to change behavior without drowning the context window. Almost
> every guideline below serves one of those two goals.

---

## 1. What a skill is

A skill is a self-contained directory that teaches an agent a capability it doesn't
have by default. At its core it is a single `SKILL.md` file — YAML frontmatter plus a
Markdown body — optionally accompanied by bundled scripts, reference files, templates,
and assets.

The format is a genuine cross-vendor standard: the same `SKILL.md` directory is
consumed by Claude Code (natively, via the plugin marketplace), by other harnesses
(via the `npx` installer), and increasingly by other agent tools that have adopted the
Agent Skills specification. Write to the standard and the skill travels.

### The two flavors in this repo

| Flavor | Ships | Example | When to choose |
| --- | --- | --- | --- |
| **Implementation skill** | Runnable Node.js under `scripts/` (optionally `bin/`, `templates/`) | `gh-notification-summary` | The task has a deterministic core — an API call, a data transform, a dashboard — that code should own. |
| **Reference-only skill** | Pure prompt + curated `references/*.md` | `design-system` | The value is expert judgment and curated knowledge; there is no fixed procedure to automate. |

Both flavors use identical frontmatter and the same progressive-disclosure discipline.
The only difference is whether a `scripts/` directory exists. If you find yourself
writing a reference-only skill whose instructions keep saying "compute X, then Y, then
Z" the same way every time, that determinism is a signal to add a script (see
[§4](#4-instructions-vs-scripts-degrees-of-freedom)).

---

## 2. The mental model: progressive disclosure

An agent doesn't load your whole skill up front. Content is revealed in three tiers,
each with a different cost and loading trigger. **Designing a skill _is_ deciding what
belongs in which tier.**

| Tier | Content | Loaded when | Budget |
| --- | --- | --- | --- |
| **1 — Metadata** | `name` + `description` frontmatter | Always. Pre-loaded into the system prompt alongside every other skill's metadata. | ~100 words. This is the _only_ thing competing for attention at selection time. |
| **2 — Body** | The Markdown in `SKILL.md` | When the skill triggers | **< 500 lines.** Every token here competes with live conversation. |
| **3 — Bundled resources** | `references/*.md`, `scripts/*`, `templates/*`, `assets/*` | On demand — read or executed only when the body points to them | Effectively unlimited. Zero context cost until accessed. |

Three rules fall directly out of this model:

1. **The `description` is the most important text in the skill.** It's the only signal
   the agent sees when deciding whether to trigger, out of potentially 100+ skills.
   [§3](#3-the-description-field-triggering) is entirely about getting it right.
2. **The body is a table of contents, not an encyclopedia.** Keep it a lean
   orchestrator that says _which_ reference file or script to reach for and _when_.
   Push depth into Tier 3.
3. **Bundled resources are free until read** — so it is always better to move a long
   procedure, a large dataset, or a rarely-needed edge case into a reference file than
   to inline it in the body.

---

## 3. The `description` field (triggering)

The `description` is injected verbatim into the system prompt and is the sole basis for
skill selection. Treat it as a precision instrument.

**The formula:** `<what it does>. Use when <triggers: phrases, file types, contexts>.`

```yaml
description: "Review, summarize, and manage GitHub notifications. Use this skill whenever the user mentions GitHub notifications, unread GitHub activity, or open issues on their repos — even if they don't use the word 'notifications'. Also trigger for /unsub <number>, 'mark all done', or any request to triage a GitHub inbox."
```

### Rules

- **Third person, always.** "Reviews and summarizes GitHub notifications…" — never "I
  can help you…" or "You can use this to…". The description is system-prompt text;
  inconsistent point-of-view degrades discovery.
- **State both halves: _what_ it does AND _when_ to use it.** A description that only
  names a topic ("Helps with design systems") gives the agent nothing to match against.
- **Name concrete triggers.** List the actual phrases, slash commands, and file types a
  user would say or share. These are what the agent pattern-matches on.
- **Be a little "pushy."** Skills under-trigger far more often than they over-trigger.
  Language like _"whenever the user mentions X, Y, or Z, even if they don't explicitly
  ask"_ earns its keep.
- **Guard against false positives.** If a skill is easily confused with adjacent
  requests, add an explicit negative: _"Do not trigger on general HTML/CSS questions
  unrelated to design-system patterns."_

### Hard limits

| Field | Limit |
| --- | --- |
| `name` | ≤ 64 chars; lowercase letters, numbers, hyphens only; **must match the directory name exactly**; no `anthropic`/`claude`. |
| `description` | Non-empty, ≤ **1024 characters**, third person, no XML tags. |

### Anti-patterns

- ❌ `description: "Helps with documents"` — vague; matches nothing and everything.
- ❌ First/second person.
- ❌ Time-sensitive facts ("as of the August release…"). Descriptions should stay true
  indefinitely.

---

## 4. Instructions vs. scripts (degrees of freedom)

Every capability sits somewhere on a spectrum from "free-form judgment" to "run exactly
this command." Match the mechanism to the task's fragility, not to habit.

| Freedom | Mechanism | Use when |
| --- | --- | --- |
| **High** | Prose instructions in the body | Many valid approaches; the right move depends on context (e.g. a design review). |
| **Medium** | Parameterized scripts + guidance | A preferred pattern exists but some variation is fine. |
| **Low** | A specific script, run verbatim | The operation is fragile, error-prone, or must be identical every time (an API call, a data migration, a deterministic computation). |

Think of it as a landscape: an **open field** (many safe paths → give direction, let the
agent choose) versus a **narrow bridge with cliffs on both sides** (one safe path →
hand over an exact script and say "do not modify this command").

### Prefer a bundled script when the operation is deterministic

A `validate.js` you ship beats asking the agent to generate validation code each time.
Bundled scripts are:

- **More reliable** — the logic is tested, not re-derived per run.
- **Cheaper** — the agent executes them without loading their source into context; only
  their _output_ costs tokens.
- **Consistent** — every invocation behaves identically.

Make the read-vs-execute intent explicit in the body: _"Run `scripts/fetch.js` to open
the dashboard"_ (execute) vs. _"See `scripts/rank.js` for the scoring algorithm"_ (read
as reference).

### Script-quality rules

- **Solve, don't punt.** Handle `FileNotFound`, missing env vars, and bad input inside
  the script with a clear error message. Don't fail and leave the agent to guess.
- **No voodoo constants.** Every magic number gets a comment justifying it. If _you_
  can't explain why the timeout is 47 seconds, the agent can't either.
- **Declare dependencies** in the skill's `package.json` and note any environment
  requirements (tokens, network access) at the top of `SKILL.md`.
- **Forward slashes in all paths**, always — even in examples. Backslashes break on
  Unix.

---

## 5. Writing the body

The body is loaded whole when the skill triggers, so it competes with the live
conversation for attention. Assume the agent is already competent — spend tokens only on
what it _doesn't_ know or _can't see_.

- **Be concise.** Challenge every line: does the agent really need this explanation? A
  lean instruction beats a paragraph that re-teaches something the model already knows.
- **Use consistent terminology.** Pick one term per concept ("notification", not an
  alternating mix of "alert"/"item"/"thread") and stick to it. Synonyms make
  instructions ambiguous.
- **Prefer imperative, positive instructions.** "Run the fetch command, then confirm
  the result" reads better than a wall of "don't" prohibitions. Reserve strong modal
  language (**MUST**, **DO NOT**) for the rules you've observed the agent break.
- **Route with tables and decision points.** When a skill has multiple modes, open with
  a mode → trigger → procedure table (see `dreamlight-valley`) and send the agent to the
  right reference file, rather than inlining every path.
- **Give a workflow for multi-step tasks.** A numbered sequence — or a copy-in checklist
  the agent ticks off — prevents skipped validation steps.
- **Provide templates and examples for shape-sensitive output.** An input→output
  example teaches a desired style far faster than describing it.
- **No time-sensitive content in the body either.** If you must document a superseded
  approach, tuck it in a collapsed `<details>` "Old patterns" section.

---

## 6. Bundled resources (`references/`, `scripts/`, `templates/`, `assets/`)

Move anything large, optional, or domain-specific out of the body and into Tier 3.

### `references/` — documentation loaded on demand

- **Split by domain.** If a skill spans mutually-exclusive concerns, give each its own
  file so a task about one never loads the others. `design-system` splits its taxonomy
  into 12 section files; a question about form controls never pulls in the layout
  reference.
- **Keep references one level deep.** Every reference file should be linked _directly_
  from `SKILL.md`. Avoid `A → B → C` chains: agents often preview deeply-nested files
  with a partial read (`head`) and miss content.
- **Add a table of contents** to any reference file over ~100 lines, so a partial read
  still reveals the file's full scope.
- **Point to references from the body with a "when to read this" table.** Don't make the
  agent load everything to discover what's relevant — tell it _"designing an API? →
  `references/api-design.md`"_.

### `scripts/`, `templates/`, `assets/`

- `scripts/` — executable Node.js (ESM). Executed, not loaded into context.
- `templates/` — output scaffolds (e.g. the `gh-notification-summary` dashboard HTML).
- `assets/` — static files (icons, fonts, images) copied through at build time.

### A shared-fragment tip

If several skills — or several references within one skill — repeat the same
cross-cutting facts, factor them into a single canonical reference and link to it,
rather than duplicating. One source of truth is easier to keep correct.

---

## 7. Naming and layout

- **Lowercase, hyphenated** (`gh-notification-summary`), and the `name` frontmatter field
  **must equal the directory name**.
- **Name for the use case, not the API.** `gh-notification-summary` tells the agent what
  problem it solves; a name like `octokit-wrapper` doesn't. Use-case names also improve
  discovery, because they match how users describe their intent.
- **Avoid vague names** (`helper`, `utils`, `tools`) and reserved words
  (`claude`, `anthropic`).

Canonical directory shape:

```text
skills/<skill-name>/
├── SKILL.md                 # Tier 1 (frontmatter) + Tier 2 (body)
├── package.json             # private: true; declares skill.runtime
├── scripts/                 # implementation — omit for reference-only skills
├── references/              # Tier 3 docs, loaded on demand
├── templates/               # optional output scaffolds
├── assets/                  # optional static files (passthrough-copied)
├── tests/                   # node --test suite
└── evals/
    └── evals.json           # trigger / no-trigger evals
```

Each skill is a Yarn workspace member. Its `package.json` carries `"private": true` and a
`skill.runtime` field (currently only `"node"`); see [`CONTRIBUTING.md`](../.github/CONTRIBUTING.md)
for the full manifest.

---

## 8. Prove it works: tests and evals

A skill isn't done when it reads well — it's done when it triggers correctly and behaves
correctly. This repo enforces two layers, and the strongest skills borrow a third idea
from Google's `modern-web-guidance`: **evals should discriminate, not just pass.**

### Tests (`tests/`, `node --test`)

- Mock every external API call — tests must never require live credentials.
- Reference-only skills still get tests: assert the frontmatter is well-formed and that
  every `references/…` link in `SKILL.md` resolves to a real file.

### Evals (`evals/evals.json`)

Evals feed realistic prompts to the model with the skill loaded and assert the skill was
(or wasn't) invoked. Require **at least two positive** triggers and **at least two
negative** (false-positive) cases:

```json
{
	"skill_name": "<skill-name>",
	"evals": [
		{ "id": 1, "prompt": "a prompt that SHOULD trigger the skill", "expected_output": "what the agent should do", "files": [] },
		{ "id": 2, "prompt": "an adjacent prompt that should NOT trigger", "expected_output": "Does NOT trigger. Reason.", "files": [], "should_trigger": false }
	]
}
```

The positive/negative pairing is the point. A gold case that passes proves the skill
_fires_; a near-miss negative case that stays quiet proves the `description` is
_discriminating_ and not just greedily matching everything. Write the negatives to be
genuinely tempting — the closer they sit to the trigger boundary, the more they prove.

### Iterate empirically

Build a couple of evals _before_ writing extensive docs, then refine against them. If a
skill fails to fire when it should, fix the `description` first — that's almost always
where the problem is.

---

## 9. Architecture checklist

Before opening a PR, confirm:

**Discovery**
- [ ] `name` is lowercase-hyphenated and matches the directory name.
- [ ] `description` is third person, ≤ 1024 chars, and states both _what_ it does and
      _when_ to use it.
- [ ] `description` names concrete trigger phrases / commands / file types.
- [ ] False-positive boundary is addressed (a negative clause and/or negative evals).

**Structure**
- [ ] The right flavor is chosen (implementation vs. reference-only).
- [ ] `SKILL.md` body is under 500 lines and reads as an orchestrator, not an
      encyclopedia.
- [ ] Depth lives in `references/`; reference files are one level deep from `SKILL.md`.
- [ ] Reference files over ~100 lines have a table of contents.
- [ ] Deterministic operations are bundled as scripts, not left to the model to
      re-derive.

**Quality**
- [ ] Terminology is consistent; instructions are imperative and concise.
- [ ] No time-sensitive content outside an "old patterns" section.
- [ ] Scripts handle their own errors and contain no unexplained constants.
- [ ] Paths use forward slashes throughout.
- [ ] No secrets or real credentials anywhere (tests mock all external calls).

**Proof**
- [ ] `tests/` pass (`yarn test <skill-name>`) and mock all external calls.
- [ ] `evals/evals.json` has ≥ 2 positive and ≥ 2 negative cases, with tempting
      negatives.

---

## 10. Sources

The guidance above synthesizes documented best practices from across the ecosystem:

- **Anthropic — Agent Skills:** [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices),
  [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview),
  and the [`skill-creator` skill](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md).
- **Agent Skills specification:** [agentskills.io/specification](https://agentskills.io/specification).
- **Google Chrome — modern-web-guidance:** [GoogleChrome/modern-web-guidance-src](https://github.com/GoogleChrome/modern-web-guidance-src)
  (use-case-first slugs, gold/negative eval controls, guided-vs-unguided uplift, shared
  fragments).
- **Cross-tool conventions:** OpenAI Codex [Agent Skills](https://developers.openai.com/codex/skills)
  and [AGENTS.md](https://agents.md/); [Cursor Rules](https://docs.cursor.com/context/rules)
  (glob/description/always scoping); GitHub Copilot
  [custom instructions](https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot);
  Google [Gemini Gems tips](https://support.google.com/gemini/answer/15235603).
</content>
</invoke>
