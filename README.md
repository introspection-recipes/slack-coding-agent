# Slack Coding Agent

A Slack-triggered Pi recipe that lazily clones one granted GitHub repository, implements a coding request, verifies it, opens a pull request, and reports progress in the originating Slack thread.

The recipe uses the runtime repository-grant model introduced by introspection-cloud PR #2242: `runtime.github.repositories` authorizes the repository without making it an eager task checkout. At task time the agent resolves the sole grant and uses normal HTTPS `git clone` and `gh` commands with short-lived managed credentials.

## Package shape

- `SYSTEM.md` defines the repository, Slack, safety, and memory workflow.
- `agents/agent.yaml` selects the managed model, built-in tools, Ralph checkpoint tool, and four Slack MCP tools.
- `extensions/ralph-loop.mjs` continues non-terminal work through structured `ralph_status` checkpoints, with a finite safety ceiling.
- `slack-app/manifest.template.json` and `scripts/configure-slack-app.mjs` create or update the Slack app through Slack's Manifest API.
- `.introspection/slack-coding-agent.yaml` declares the GitHub grant; deployment binds the required `slack` connector to the runtime environment.

## Repository prerequisite

The manifest currently targets `tfidfwastaken/openclaw`, the intended writable fork of `openclaw/openclaw`. Create and register that fork with the Introspection project before deployment, or replace the slug with another registered writable repository. The agent never pushes directly to an upstream repository it cannot write.

## Slack app bootstrap

Create the Introspection Slack connector first so you have its OAuth redirect and Events API request URLs. Generate a short-lived Slack app configuration token, then run:

```bash
export SLACK_APP_CONFIG_TOKEN='...'
export SLACK_OAUTH_REDIRECT_URL='https://...'
export SLACK_EVENTS_REQUEST_URL='https://...'
node scripts/configure-slack-app.mjs
```

The script validates and creates the app programmatically. It prints no Slack secret; the creation response is written to ignored `.slack/credentials.json` with mode `0600`. Set `SLACK_APP_ID` to update an existing app. A human must still approve Slack's workspace OAuth consent URL.

Store the returned client and signing credentials in the Introspection connector through the deployment workflow. Never commit `.slack/credentials.json` or configuration tokens.

## Memory

When an authenticated task has durable memory, the agent maintains a concise `/workspace/memories/MEMORY.md` index and per-repository notes under `/workspace/memories/repos/`. It stores verified conventions and preferences only. Memory remains environment- and owner-scoped and is never used for secrets or transient task state.

## Validate

```bash
introspection check
```

The live capability check belongs in staging because local Pi cannot faithfully reproduce Slack ingress or the managed GitHub credential helper.

## License

Apache-2.0. The starter template attribution and license are preserved in `LICENSE`.
