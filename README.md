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

## Slack setup (shortest path)

Deploy the recipe first so the runtime `slack-coding-agent` exists. For local Introspection development, also keep the public webhook relay running in another terminal:

```bash
cd /path/to/introspection-cloud
make dev-relay
```

1. At [api.slack.com/apps](https://api.slack.com/apps), create a **Blank app** in the target workspace. On **Basic Information**, copy its Client ID, Client Secret, and Signing Secret.

2. Put the Client Secret on line 1 and Signing Secret on line 2 of a temporary `secret-file`, then create the connector. Replace `<client-id>` with the non-secret Client ID shown by Slack.

```bash
chmod 600 secret-file
exec 3<secret-file
IFS= read -r SLACK_CLIENT_SECRET <&3
IFS= read -r SLACK_SIGNING_SECRET <&3
exec 3<&-

introspection connectors create \
  --name "Slack Coding Agent (staging)" \
  --slug slack \
  --provider slack \
  --auth-mode oauth-stored \
  --environment staging \
  --client-id '<client-id>' \
  --client-secret "$SLACK_CLIENT_SECRET" \
  --signing-secret "$SLACK_SIGNING_SECRET" \
  --authorization-endpoint https://slack.com/oauth/v2/authorize \
  --token-endpoint https://slack.com/api/oauth.v2.access \
  --api-host slack.com \
  --scope chat:write --scope app_mentions:read \
  --scope channels:history --scope channels:read --scope channels:join \
  --scope groups:history --scope groups:read \
  --scope im:history --scope im:read \
  --scope mpim:history --scope mpim:read \
  --scope reactions:write --scope users:read \
  --yes --non-interactive

unset SLACK_CLIENT_SECRET SLACK_SIGNING_SECRET
```

3. Copy the connector `id` from the command output. In the Slack app's **App Manifest** page, paste [`slack-app/manifest.template.json`](slack-app/manifest.template.json), replacing its two placeholders with:

```text
SLACK_OAUTH_REDIRECT_URL=http://localhost:8000/v1/oauth/connections/callback
SLACK_EVENTS_REQUEST_URL=https://api.development.introspection.dev/v1/webhooks/slack/<connector-id>
```

Save the manifest and confirm that Slack marks the Events API request URL **Verified**. Then activate the same URL on the connector:

```bash
introspection connectors update slack \
  --webhook-url 'https://api.development.introspection.dev/v1/webhooks/slack/<connector-id>' \
  --status active \
  --yes --non-interactive
```

4. Bind the workspace to the deployed runtime. Open the single-use URL printed by this command and click **Allow** in Slack:

```bash
introspection connectors authorize slack \
  --runtime slack-coding-agent \
  --subject app
```

5. In a Slack channel, run `/invite @Coding Agent`, then send `@Coding Agent inspect the repository and summarize its structure`.

After authorization succeeds, delete `secret-file`; the encrypted connector copy is the source of truth. For a hosted control plane, replace the localhost callback and development relay hostname with that environment's public URLs.

## Memory

When an authenticated task has durable memory, the agent maintains a concise `/workspace/memories/MEMORY.md` index and per-repository notes under `/workspace/memories/repos/`. It stores verified conventions and preferences only. Memory remains environment- and owner-scoped and is never used for secrets or transient task state.

## Validate

```bash
introspection check
```

The live capability check belongs in staging because local Pi cannot faithfully reproduce Slack ingress or the managed GitHub credential helper.

## License

Apache-2.0. The starter template attribution and license are preserved in `LICENSE`.
