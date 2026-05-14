---
name: gh-notification-summary
description: "Review, summarize, and manage GitHub notifications. Use this skill whenever the user mentions GitHub notifications, unread GitHub activity, open issues on their repos, or wants to catch up on project discussions — even if they don't use the word 'notifications'. Also trigger for /unsub <number>, 'mark all done', 'clear my GitHub inbox', or any request to triage, dismiss, or act on GitHub notifications."
---

# GitHub Notification Reviewer

Fetch, display, and act on unread GitHub notifications via a local dashboard.

## Environment

- `GITHUB_TOKEN` — required (env or `<skill-path>/.env`)
- `GITHUB_REPO` — optional default for `--repo` (format: `owner/repo`)

## Commands

All actions invoke the `gh-notifications` bin (installed by the skill's `package.json`).

| User intent | Command | Notes |
|---|---|---|
| Open the dashboard | `gh-notifications fetch [--repo owner/repo]` | Blocks until **Ctrl+C**; opens browser at `http://localhost:8000`. Without `--repo` or `GITHUB_REPO`, shows all unread notifications. |
| Unsubscribe from an issue | `gh-notifications unsub <number> --repo owner/repo` | Deletes thread subscription + marks done. `--repo` falls back to `GITHUB_REPO`. |
| Mark one issue done | `gh-notifications done <number> --repo owner/repo` | `--repo` falls back to `GITHUB_REPO`. |
| Mark all done | `gh-notifications done` | No issue arg = clear inbox. |

## Workflow

1. Run `gh-notifications fetch` and tell the user the dashboard is at `http://localhost:8000`.
2. Wait for the user to ask for follow-up actions (unsub, mark done).
3. Run the matching command from the table. Confirm the result.
4. When the user is finished, remind them to **Ctrl+C** the `fetch` process to free port 8000.

## Reference

- Dashboard template: `<skill-path>/templates/dashboard.html` (Nunjucks; edit to customize).
- Development setup and local preview: `<skill-path>/references/development.md`.
