---
"@allons-y/agent-skills": minor
"@allons-y/skill-webc-components": minor
---

New skill: **webc-components**, for writing and reviewing WebC components that render the way they read.

Most WebC bugs compile cleanly and only show up in the HTML: a skip link that renders empty because the call site has a line break in it, a list that picks up bullets only when it sits inside a prose container, a boolean prop that stays on when set to `"false"`, a build that crashes over one `undefined` style. This skill gives the agent a model of what the WebC compiler actually does, read at source level and checked by rendering, so it catches those before they ship.

What it does:

- Writes new components with the traps already avoided: host tags that stay put, props that resolve to the value passed, slot fallbacks that cannot be silently defeated, and styles that never leak into whatever gets slotted in
- Reviews a component or a whole library against a checklist of rules drawn from a real component library review, reporting each finding with the input that breaks it, the HTML it renders, the fix, and a test that pins it
- Explains surprises: why a prop resolves to an Eleventy filter, why slotted content cannot see the outer component's props, why two components' styles fight only on some pages
- Keeps WebC facts and house style apart, with the Allons-y studio conventions offered as an opt-in layer

Say anything like "write a WebC component", "review this .webc file", "why is my slot fallback empty", or "audit our WebC components", or paste a `.webc` file.
