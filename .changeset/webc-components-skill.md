---
"@allons-y/agent-skills": minor
"@allons-y/skill-webc-components": minor
---

New skill: **webc-components**, for writing and reviewing WebC components.

Most WebC bugs compile without error, with issues appearing only in the rendered HTML; a skip link that renders empty because the call site has a line break in it, a list that shows bullets only when it is placed inside a prose container, a boolean prop that stays on when set to `"false"`, a build that crashes over one `undefined` style. This skill documents how the WebC compiler behaves, taken from its source code and checked by compiling, so the agent avoids these bugs and finds them in review.

What it does:

- Writes new components that avoid these bugs: custom tags that render predictably, props that resolve to the value passed, slot fallbacks that always render when needed, and styles that do not apply to components slotted inside them
- Reviews a component or a whole library against a checklist of rules drawn from a real component library review, reporting each finding with the input that breaks it, the HTML it renders, the fix, and a regression test
- Explains surprises: why a prop resolves to an Eleventy filter, why slotted content cannot see the outer component's props, why one component's styles override another's only on some pages
- Keeps WebC facts and style choices apart: universal practices apply everywhere, while choices with more than one valid answer (how styles are scoped, where docs live, how behavior attaches) are yours to make
- Works wherever WebC runs: Eleventy, Express, Koa, Fastify, Vite, or a custom Node server or build, with what each host changes (setup timing, data, helpers, bundling) and a render function that bundles correctly
- Remembers how your team builds components: pick a preset (`site`, `library`, or `class-based`) or answer a few questions, add house rules of your own, and save the result to memory or as a file next to the skill, so every component and review follows it

Say anything like "write a WebC component", "review this .webc file", "why is my slot fallback empty", "audit our WebC components", or "set up my WebC conventions", or paste a `.webc` file.
