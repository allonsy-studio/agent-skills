# @allons-y/skill-webc-components

Author and review WebC (`@11ty/webc`) components. The skill explains how WebC 0.11.x
compiles a component, from its source code, so an agent can predict the rendered HTML
and find the bugs that compile without errors: empty slot fallbacks, props that
resolve to the wrong value, and styles that leak between components.

See [`SKILL.md`](./SKILL.md) for the instructions the agent reads.

## What it covers

| File | Contents |
| --- | --- |
| [`SKILL.md`](./SKILL.md) | A symptom lookup table, workflows for writing and reviewing components, profile setup, and a render recipe |
| [`references/webc-internals.md`](./references/webc-internals.md) | How WebC compiles a component, with source citations |
| [`references/review-checklist.md`](./references/review-checklist.md) | Review rules, each with the behaviour, how to find it, the fix, and a test |
| [`references/conventions.md`](./references/conventions.md) | Universal practices, decision points with options, and three presets |
| [`templates/profile.md`](./templates/profile.md) | The format for a saved profile |

## Profiles

Teams make different style choices (tag selectors or `webc:scoped`, slots or props,
JSDoc or READMEs). On first use the skill offers the presets `site`, `library`, and
`class-based`, or a custom set of choices, and saves the result to the agent's memory
or to `profile.md` in the skill directory. Conventions in a project's `AGENTS.md` or
`CLAUDE.md` take precedence over a saved profile.

## Choosing a model

Recommended: **Claude Sonnet 5.5**. It handles writing and reviewing components,
including running the render recipe to verify findings.

| Task | Suggested model |
| --- | --- |
| One question about WebC behaviour ("why is my slot empty?") | Claude Haiku 5.5 or Sonnet 5.5 |
| Writing or reviewing one component | Claude Sonnet 5.5 |
| Auditing a whole component library | Claude Opus 5.5 |

Why:

- Smaller models do well when a symptom matches a row in the lookup table at the top of
  `SKILL.md`. Each row names the cause, the fix, and the one section to read.
- A library audit means holding many components at once and checking how their styles
  interact. Larger models miss fewer of these interactions.
- Any model should render each finding before calling it verified. A model that cannot
  run code marks findings as not rendered.

These suggestions follow from what each task asks of the model. They are not yet backed
by measured eval runs.

## Development

```sh
yarn test webc-components
```

Tests check that `SKILL.md`, the references, the profile template, and the evals stay
consistent with each other. Evals live in `evals/evals.json`.
