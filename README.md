# OpenClaw Config Helper

A [Next.js](https://nextjs.org/) web app for managing and inspecting [OpenClaw](https://github.com/openclaw) deployments on a remote VPS. It centralizes configuration visibility, security audits, credential hygiene, and agent-driven suggestions behind one local UI—typically used with private access (for example over Tailscale) so you do not need to expose the control plane publicly.

## Features

- **Configuration** — Browse and get plain-language explanations of the live `openclaw.json` (via SSH or local paths, depending on setup).
- **Security audit** — Run audits, review findings, and apply remediations through the gateway when you choose to.
- **Credentials** — Spot plaintext secrets and migrate toward safer patterns (e.g. env-backed references) with review before apply.
- **Suggestions** — Surface recommendation cards from the OpenClaw suggestions agent; save, dismiss, or apply from the UI.

## Requirements

- Node.js compatible with the versions in `package.json` (Node 20+ is a safe default for Next 16).
- Network path to your OpenClaw gateway host when using SSH access mode (and optional gateway token).

## Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/jcpinto54/openclaw-config-helper.git
   cd openclaw-config-helper
   npm install
   ```

2. Copy environment template and edit values:

   ```bash
   cp .env.example .env
   ```

   See `.env.example` for `MOCK_MODE`, `OPENCLAW_ACCESS_MODE`, SSH settings, gateway token, OpenClaw paths, and `WEBAPP_SECRET`. **Treat `.env` as secret**; it is gitignored.

   - `OPENCLAW_ACCESS_MODE=mock` uses seeded local demo data.
   - `OPENCLAW_ACCESS_MODE=local` reads the real OpenClaw files directly from the same machine.
   - `OPENCLAW_ACCESS_MODE=ssh` reads the real OpenClaw files over SSH using `SSH_HOST`, `SSH_USER`, and `SSH_KEY_PATH`.

   **Gateway Connection (Optional):**
   - Setting `OPENCLAW_GATEWAY_TOKEN` enables a live WebSocket connection to the OpenClaw daemon. This allows the Config Helper to trigger immediate configuration reloading and real-time operations without requiring a daemon restart.

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) (or the port you set in `WEBAPP_PORT`).

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Development server       |
| `npm run build`| Production build         |
| `npm run start`| Run production server    |
| `npm run lint` | ESLint                   |

## Project layout

- `app/` — Next.js App Router pages and API routes.
- `components/` — UI panels (config, audit, credentials, suggestions, setup).
- `lib/` — OpenClaw integration, SSH/gateway bridges, DB, and domain logic.

Detailed behavior and data flows are described in [`project-spec.md`](./project-spec.md).

## Security notes

- Set a strong `WEBAPP_SECRET` and restrict who can reach the app.
- Use SSH keys and least-privilege access to the VPS; never commit real credentials or `.env`.
- For production, run behind HTTPS and your preferred auth boundary (reverse proxy, VPN, etc.).

## Automated deployment (GitHub + Tailscale)

This repository includes a production deploy workflow at `.github/workflows/deploy.yml` that runs on each push to `main` (and supports manual runs with `workflow_dispatch`).

### How it works

1. GitHub Actions starts an ephemeral runner.
2. The job joins your tailnet using `tailscale/github-action`.
3. The job opens a strict-host-checked SSH connection to your VPS over tailnet.
4. The job runs `scripts/deploy.sh <commit-sha>` on the VPS so the server deploys the exact pushed commit.

### Required GitHub secrets

- `TS_OAUTH_CLIENT_ID`: Tailscale OAuth client ID for CI.
- `TS_OAUTH_SECRET`: Tailscale OAuth secret for CI.
- `DEPLOY_HOST`: VPS Tailnet hostname or Tailnet IP (for example `vps-name.tail123.ts.net`).
- `DEPLOY_USER`: SSH deploy user on the VPS.
- `DEPLOY_SSH_KEY`: Private key used by GitHub Actions to SSH into the VPS.
- `DEPLOY_SSH_KNOWN_HOSTS`: Pinned SSH host key entry for strict host checking.

### Optional GitHub repository variables

- `DEPLOY_PORT`: SSH port (default `22`).
- `DEPLOY_APP_DIR`: App path on VPS (default `/opt/openclaw-config-helper`).
- `DEPLOY_BRANCH`: Branch metadata for logs (default `main`).
- `DEPLOY_RESTART_COMMAND`: Runtime restart command (empty by default).
- `DEPLOY_HEALTH_CHECK_COMMAND`: Post-restart health check command (empty by default).

### VPS bootstrap checklist

1. Create a dedicated non-root deploy user (for example `deploy`).
2. Clone this repository to `/opt/openclaw-config-helper` (or set `DEPLOY_APP_DIR` accordingly).
3. Ensure Node.js + npm are available for `npm ci` and `npm run build`.
4. Ensure the deploy user can run your chosen restart command.
5. Add the corresponding public key for `DEPLOY_SSH_KEY` to `~/.ssh/authorized_keys` on the VPS.
6. Capture host key for `DEPLOY_SSH_KNOWN_HOSTS` (from a trusted machine), for example:
   ```bash
   ssh-keyscan -p 22 vps-name.tail123.ts.net
   ```

### Minimal Tailscale ACL model

- Tag your workflow identity with `tag:ci`.
- Allow `tag:ci` to access only the deploy target on SSH.
- Deny broad lateral access from CI identities.

### Manual dry-run on VPS

From the VPS (or SSH session with deploy user), run:

```bash
cd /opt/openclaw-config-helper
DEPLOY_RESTART_COMMAND="sudo systemctl restart openclaw-config-helper" \
DEPLOY_HEALTH_CHECK_COMMAND="curl --fail http://127.0.0.1:3000/" \
bash ./scripts/deploy.sh <commit-sha>
```

### Troubleshooting

- `tailscale ping` fails in workflow:
  - Verify OAuth credentials are valid and allowed to create tagged ephemeral nodes.
  - Verify ACLs allow `tag:ci` to reach the VPS.
- SSH host key mismatch:
  - Refresh `DEPLOY_SSH_KNOWN_HOSTS` from a trusted machine if host keys changed intentionally.
- Restart command fails:
  - Confirm deploy user permissions (for example `sudoers` rules for `systemctl`).
- Health check fails:
  - Verify app boot time and endpoint path; adjust `DEPLOY_HEALTH_CHECK_COMMAND`.
- Workflow missing secrets:
  - Check repository or environment secret names exactly match README/workflow keys.

## License

ISC (see [`package.json`](./package.json)).
