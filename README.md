# OpenClaw Config Helper

A [Next.js](https://nextjs.org/) web app for managing and inspecting [OpenClaw](https://github.com/openclaw) deployments on a remote VPS. It centralizes configuration visibility, security audits, credential hygiene, and agent-driven suggestions behind one local UI—typically used with private access (for example over Tailscale) so you do not need to expose the control plane publicly.

## Features

- **Configuration** — Browse and get plain-language explanations of the live `openclaw.json` (via SSH or local paths, depending on setup).
- **Security audit** — Run audits, review findings, and apply remediations through the gateway when you choose to.
- **Credentials** — Spot plaintext secrets and migrate toward safer patterns (e.g. env-backed references) with review before apply.
- **Suggestions** — Surface recommendation cards from the OpenClaw suggestions agent; save, dismiss, or apply from the UI.

## Requirements

- Node.js compatible with the versions in `package.json` (Node 20+ is a safe default for Next 16).
- Network path to your OpenClaw gateway host when not using mock mode (SSH and optional gateway token).

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

   See `.env.example` for `MOCK_MODE`, SSH settings, gateway token, OpenClaw paths, and `WEBAPP_SECRET`. **Treat `.env` as secret**; it is gitignored.

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

## License

ISC (see [`package.json`](./package.json)).
