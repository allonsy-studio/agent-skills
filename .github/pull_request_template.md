<!--
Thanks for contributing! Fill in the sections that apply and delete the rest.
Squash to a single Conventional Commit before merge — the commit body becomes
the changelog entry, so write it customer-focused (see CONTRIBUTING.md).
-->

## What & why

<!-- What does this change do, and what problem does it solve? Explain the "why", not just the "what". -->

Closes #

## Type of change

- [ ] New skill
- [ ] Skill enhancement (new capability / behavior change)
- [ ] Bug fix
- [ ] Docs only
- [ ] Tooling / CI / scripts

## Skill checklist

<!-- Required for new skills and skill changes. Check "N/A" and skip if this PR touches no skill. -->

- [ ] N/A — this PR doesn't touch a skill

**Discovery**

- [ ] `name` is lowercase-hyphenated and matches the directory name
- [ ] `description` is third person, ≤ 1024 chars, and states both *what* it does and *when* to use it
- [ ] `description` names concrete trigger phrases / commands / file types
- [ ] The false-positive boundary is addressed (a negative clause and/or negative evals)

**Structure**

- [ ] The right flavor is used (implementation vs. reference-only)
- [ ] `SKILL.md` body is under 500 lines and reads as an orchestrator, not an encyclopedia
- [ ] Depth lives in `references/`; reference files are one level deep from `SKILL.md`
- [ ] Deterministic operations are bundled as scripts rather than left to the model to re-derive

**Proof**

- [ ] `tests/` pass (`yarn test <skill-name>`) and mock all external calls — no live credentials
- [ ] `evals/evals.json` has ≥ 2 positive and ≥ 2 negative (false-positive) cases

> New here? See [How to architect a skill](../docs/skill-architecture.md) for the reasoning behind each item.

## Verification

<!-- How did you test this? Paste command output where useful (e.g. `yarn test`, `yarn lint`, `yarn evals`). -->

## Anything reviewers should know

<!-- Trade-offs, follow-ups, screenshots, or open questions. Delete if none. -->
