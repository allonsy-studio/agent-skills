---
"@allons-y/agent-skills": minor
---

Adds the `eleventy` skill — expert Eleventy (11ty) v3 guidance for AI agents.

Ask Claude to scaffold an Eleventy project, debug a build, or wire up a feature and it now works from current v3 documentation instead of stale training data. The skill routes each task to focused reference docs covering:

- Configuration: `eleventy.config.js` shapes, directories, passthrough copy, ignores, dev server, events, transforms, CLI, and the plugins bundled with core
- The data cascade: global/directory/template data files, front matter, computed data, and custom data formats
- Templating: layouts, permalinks, filters, shortcodes, collections, and dates, with deep dives on Nunjucks + Markdown, WebC, and 11ty.js JavaScript templates
- Data-driven pages: pagination, one-page-per-item from APIs or a CMS, cached fetching with `@11ty/eleventy-fetch`, and i18n
- Assets and performance: `eleventy-img`, the Bundle plugin, Sass/esbuild via `addExtension`, incremental builds, profiling, and deployment

Say things like "set up an Eleventy project", "generate pages from an API with Eleventy", or "my Eleventy build is slow" to trigger it.
