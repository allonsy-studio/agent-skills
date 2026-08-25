---
"@allons-y/agent-skills": minor
"@allons-y/skill-devenv-guide": minor
---

New skill: **devenv-guide**, for writing developer environment setup guides that someone can actually follow alone, at 11pm, without you.

Give it a list of tools, the platforms you support, and who the guide is for, and it produces a print-ready PDF with each platform's steps side by side. Two properties make these guides work, and the skill holds onto both:

- **Every install step ends with a check.** Not "it should work" — the actual string that appears on screen when it did.
- **Troubleshooting is indexed by error text**, not by topic, because readers search for what is on their screen.

It covers 23 tools — editors, Git, Node, Python, PHP, Go, Rust, Java, Docker, Postgres, MySQL, Redis, SQLite — and, crucially, their version managers. "Install Node" and "install Node through nvm" are different documents, and the skill defaults to the second one.

Two scripts do the work that shouldn't be left to judgment:

- `order-tools.js` resolves your selection into install order, adds the prerequisites you forgot, and warns about combinations that produce a contradictory guide (two version managers for one runtime, or nvm on Windows, which is a different project with different syntax).
- `build-guide.js` renders the PDF and then verifies it, catching the failure modes that survive visual review — most importantly commands that wrap inside a narrow column and arrive broken when a reader copies them out.

Say anything like "write a setup guide", "new hires keep asking how to get set up", "install instructions for Python and Postgres, Mac and Windows", or "add Docker to the guide we made last month".
