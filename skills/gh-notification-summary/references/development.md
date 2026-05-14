# Development & local preview

For developers iterating on this skill (not for runtime agent consumption).

## Running the dashboard against your own GitHub account

```bash
# 1. Copy the example env file and fill in your token
cp <skill-path>/.env.example <skill-path>/.env

# 2. Launch the dashboard
yarn workspace @allons-y/skill-gh-notification-summary preview
```

Your browser opens automatically at `http://localhost:8000`. The command keeps running until you stop it with **Ctrl+C** (which shuts down the server and frees the port).

## Architecture

- `scripts/caching.js` — TTL + LRU enrichment cache with optional disk persistence.
- `scripts/github.js` — Pure helpers for parsing notifications, formatting dates, enriching with issue/comment data, and finding thread IDs. Exports a slim `Notifications` class for test-mode fixture loading.
- `scripts/server.js` — `createHandler` (dashboard HTTP handler) and `startHttpServer` (boots the local dashboard).
- `bin/cli.js` — yargs-driven CLI entry point.
- `templates/dashboard.{html,css,js}` — Nunjucks dashboard surface.

## Running tests

```bash
yarn workspace @allons-y/skill-gh-notification-summary test
yarn workspace @allons-y/skill-gh-notification-summary coverage
```

Tests use a fixture-driven mock Octokit (see `tests/fixtures/octokit-mock.js`) — they never hit the network.
