OPENCLAW CONFIGURATION MANAGEMENT WEBAPP
Formal Specification
Document Version: 1.0
Date: March 28, 2026
Purpose: Specification for an OpenClaw configuration management and discovery webapp
Target Audience: AI agents, developers, and system architects

1. Overview
This webapp serves as a unified management interface for OpenClaw personal assistants running on remote VPS infrastructure. It provides four core capabilities:

Configuration Transparency — Human-readable visualization and explanation of active OpenClaw configs

Security Auditing & Remediation — Detection and one-click application of security improvements

Credentials Hygiene — Migration from plaintext to SecretRef providers with automatic patch generation

Use Case Discovery — Dynamic recommendation engine powered by an autonomous OpenClaw agent

The webapp is designed for local VPS deployment with secure remote access via Tailscale, eliminating the need for public port exposure.

2. Architecture
2.1 System Components
text
┌─────────────────────────────────────┐
│      User Browser (HTTPS)           │
│  - React/Next.js Frontend           │
│  - Config Inspector Panel           │
│  - Security Audit Dashboard         │
│  - Recommendations Feed             │
│  - Credentials Manager              │
└──────────────┬──────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────┐
│   Webapp Backend (Node.js)          │
│  - Config Read/Parse/Patch Logic    │
│  - SSH Proxy for CLI Commands       │
│  - WebSocket Bridge to Gateway      │
│  - File Watcher (SUGGESTIONS.json)  │
│  - Saved Recommendations DB         │
└──────────────┬──────────────────────┘
               │ Local loopback (18789) + SSH
┌──────────────▼──────────────────────┐
│    OpenClaw Gateway (VPS)           │
│  - Config at ~/.openclaw/openclaw.json  │
│  - Agents workspace (~/.openclaw/agents)  │
│  - RPC API (config.get, config.patch)    │
│  - Suggestions agent (24h heartbeat)     │
└─────────────────────────────────────┘
2.2 Data Flow
Configuration Transparency:

Backend reads ~/.openclaw/openclaw.json via SSH

Parses JSON5 and extracts high-level structure (channels, models, agents, auth)

Frontend renders annotated config panel with explanations per key

User can inspect auth profiles, tool policies, and agent routing

Security Audit:

Backend runs openclaw security audit --json via SSH (no --fix at this stage)

Parses structured findings JSON and deduplicates findings

Frontend renders each finding as a card with severity, description, and recommended action

User clicks [Apply] → Backend generates config.patch payload and pushes via RPC

Backend polls openclaw gateway status to confirm patch applied

Credentials Hygiene:

Backend scans config for plaintext credentials (no $env:, $file:, or $exec: prefix)

Generates recommended SecretRef migrations (primary suggestion: $env:PROVIDER_KEY)

Frontend renders migration cards with one-click patch generation

User reviews and applies patch; backend validates via openclaw secrets audit --json

Use Case Discovery:

Backend maintains CURRENT_SETUP.md (live snapshot of installed skills, channels, config state)

Suggestions agent runs every 24h (or on manual trigger via openclaw system event)

Agent writes ~/.openclaw/agents/suggestions/SUGGESTIONS.json with ranked recommendation cards

Backend watches file via inotify/SSH polling and ingests new cards

Frontend renders cards with [Apply] and [Save for Later] buttons

Dismissed cards are logged to SUGGESTIONS_HISTORY.md to prevent re-suggestion

Applied cards are recorded in history; saved cards persist in webapp DB across refreshes

3. Feature Specification
3.1 Configuration Inspector Panel
Purpose: Provide transparency over the live OpenClaw config with plain-English explanations.

Inputs:

~/.openclaw/openclaw.json (read via SSH)

Outputs:

Hierarchical tree view of config keys

Annotations for each section (what it means, current state, security implications)

Collapsible sections: gateway, agents, models, channels, tools, skills, plugins, auth

Key Sections:

Section	Content	Annotations
Gateway	bind address, port, auth token presence, heartbeat settings	Security posture (e.g., "loopback-only ✓"), port exposure risk
Agents	List of agent IDs, workspace paths, model routing	How many agents, isolation mode, multi-agent routing rules
Models	Provider configs (Anthropic, OpenAI, etc.), model names, rate limits	Active providers, fallback chains, context window per model
Channels	Telegram, WhatsApp, Discord, etc. — account presence, policies	Which channels are active, DM restrictions, mention requirements
Tools	Enabled tool categories (web_search, file_read, shell, etc.)	Which tools are available to agents, scope constraints
Credentials	SecretRef audit (summary: plaintext count, unresolved refs)	⚠️ Plaintext warnings, ✓ SecretRef adoption rate
UI/UX:

Expandable tree with icons (🔒 for auth, 🌐 for channels, 🛠️ for tools, etc.)

Inline status badges (✓ OK, ⚠️ Warning, ❌ Error)

"Copy JSON path" button for each key

"Edit key" button triggers recommendation card or direct patch entry

Search/filter by key name or section

3.2 Security Audit Dashboard
Purpose: Detect misconfigurations and provide one-click remediation cards.

Inputs:

openclaw security audit --deep --json output (run via SSH)

openclaw secrets audit --json output (credentials audit)

Outputs:

Prioritized list of security findings

Auto-generated config.patch payloads for each fixable item

Manual action prompts for non-auto-fixable issues

Priority Tiers (Severity Order):

Tier	Examples	Action Type
Critical	gateway.bind_no_auth, fs.config.perms_world_readable, inlined secrets	Auto-patch available
High	gateway.tailscale_funnel_on_public_bind, missing allowFrom policies	Auto-patch available; verify before apply
Medium	plugins.untrusted_source, weak model routing, stale tokens	Manual review recommended
Low	Informational: "No browser control configured", "Unused skills installed"	Educational; optional fix
Card Schema (per finding):

json
{
  "findingId": "fs.config.perms_world_readable",
  "severity": "critical",
  "title": "Config file readable by others",
  "description": "~/.openclaw/openclaw.json has world-readable permissions. Anyone on the system can read API keys.",
  "currentState": "permissions: -rw-r--r--",
  "fixType": "auto",
  "fixPayload": {
    "type": "shell_command",
    "command": "chmod 600 ~/.openclaw/openclaw.json",
    "expectedOutcome": "File now readable only by owner"
  },
  "status": "new",
  "appliedAt": null,
  "dismissedAt": null
}
UI/UX:

Cards sorted by severity (red → yellow → blue)

"Auto-fixable" badge with green [Apply] button

"Requires review" badge with yellow [Review] button (opens detail view)

Expansion shows: full description, current state, recommended fix, link to docs

After [Apply]: shows spinner, confirms patch was pushed to gateway, then updates card to "applied" state

Option to [Dismiss] — records dismissal in audit history (useful for false positives)

3.3 Credentials Hygiene Panel
Purpose: Identify plaintext secrets and migrate to SecretRef providers.

Inputs:

openclaw secrets audit --json output (plaintext detection)

~/.openclaw/openclaw.json (credential key extraction)

auth-profiles.json (if present)

Outputs:

List of detected plaintext credentials

Recommended SecretRef migration per credential

Credential Detection Strategy:

Scan Config — Look for values that match patterns:

sk-* (OpenAI API keys)

ghp_* (GitHub personal access tokens)

Telegram bot tokens (numeric)

Discord bot tokens

AWS credentials, etc.

Flag as Plaintext — If value is not wrapped in SecretRef syntax:

❌ "token": "abc123xyz"

❌ "token": "ghp_abc123xyz"

✅ "token": "$env:GITHUB_TOKEN"

✅ "token": "$file:/etc/secrets/github.txt"

✅ "token": "$exec:pass github-token"

Migration Options (in priority order):

Provider	Syntax	Best For	Pros	Cons
env	$env:VAR_NAME	Simple, all credentials	Works with systemd, simple to rotate	Requires restart to change
file	$file:/path/to/secret	Stable, internal credentials	Can be rotated without restart	Requires file management
exec	$exec:vault get secret	Dynamic, third-party secrets	Integrates with Vault, pass, age	Adds command complexity
Migration Card Schema:

json
{
  "credentialId": "anthropic_api_key",
  "keyPath": "models.anthropic.apiKey",
  "detectedType": "anthropic_key",
  "currentState": "plaintext",
  "suggestedProvider": "env",
  "suggestedRefId": "ANTHROPIC_API_KEY",
  "migrationSteps": [
    "Export current value: `echo $YOUR_VALUE | xclip`",
    "Set environment variable: `export ANTHROPIC_API_KEY=...` in ~/.bashrc or systemd EnvironmentFile",
    "Apply config patch to use $env:ANTHROPIC_API_KEY",
    "Verify with: `openclaw secrets audit --json`"
  ],
  "patchPayload": {
    "models": {
      "anthropic": {
        "apiKey": "$env:ANTHROPIC_API_KEY"
      }
    }
  },
  "status": "new"
}
UI/UX:

Red banner: "⚠️ X plaintext credentials detected"

Cards grouped by provider (OpenAI, Anthropic, GitHub, etc.)

Each card shows: current key, suggested SecretRef, migration steps

[Apply] button generates config.patch; success = card turns green

[Learn More] link to docs on SecretRef providers

After all plaintext migrated: green banner "✓ All credentials secured with SecretRef"

3.4 Use Case Discovery & Recommendations Feed
Purpose: Provide an autonomously-refreshed feed of actionable use case recommendations tailored to the user's setup.

3.4.1 Recommendations Engine (Suggestions Agent)
Architecture:

The webapp configures a dedicated suggestions agent within OpenClaw that runs autonomously:

json
{
  "agents": {
    "list": [
      {
        "id": "suggestions",
        "heartbeat": {
          "every": "24h",
          "target": "none",
          "isolatedSession": true,
          "lightContext": true,
          "model": "anthropic/claude-opus-4-6",
          "prompt": "Read HEARTBEAT.md strictly. Research new OpenClaw use cases and write SUGGESTIONS.json."
        }
      }
    ]
  }
}
Initialization Workflow:

On first webapp launch, the user completes a 5-question wizard:

"What's your main role? (dev / finance / freelance / other)"

"What devices/services do you use? (Notion, Jira, GitHub, Home Assistant, Todoist, etc.)"

"What do you want most? (save time / stay informed / automate home / build things)"

"Should the agent inform or act? (observe only / can execute)"

"Hard limits? (e.g., 'never touch my email', 'no browser')"

Webapp generates HEARTBEAT.md with these answers encoded:

text
# Suggestions Research Heartbeat

## Your Profile
- Role: Software developer
- Devices/Services: GitHub, Jira, Slack, Home Assistant
- Priority: Save time
- Execution policy: Can execute
- Off-limits: Personal email, production AWS credentials

## Research Mandate
Research what people are automating with AI agents in 2026, focusing on:
- Developer productivity: CI/CD, code review, issue triage
- Home automation: Roborock, Philips Hue, smart switches
- Scheduling & calendar: Meeting prep, conflict detection
- Information aggregation: Tech news digest, Slack insights

Vary your research angle each run. Use web search freely.
Aim for 5-8 novel recommendations per run.

## Deduplication & Relevance Filter
Before writing any card, check it against:
- CURRENT_SETUP.md (installed skills, active channels)
- SUGGESTIONS_HISTORY.md (previously suggested, applied, dismissed)

DISCARD if:
- Requires a skill/channel not yet installed
- Already appears in history (fuzzy match okay)
- Involves off-limits domains

## Output Contract
Write results to SUGGESTIONS.json with schema:
{
  "timestamp": "2026-03-28T10:00:00Z",
  "suggestions": [
    {
      "id": "unique-slug",
      "title": "Use case title",
      "category": "Automation|Knowledge|Home|Dev",
      "why_relevant": "Why this matches your setup",
      "complexity": "Low|Medium|High",
      "payload_type": "prompt|config.patch|shell_command",
      "payload": "...",
      "source_url": "optional_link"
    }
  ]
}
Webapp places HEARTBEAT.md at ~/.openclaw/agents/suggestions/HEARTBEAT.md via SSH

Webapp adds suggestions agent to openclaw.json via config.patch

Suggestions agent wakes at next 24h tick (or immediately via manual trigger)

3.4.2 Live Setup Context (CURRENT_SETUP.md)
The webapp maintains a live snapshot of the user's setup, updated whenever the config changes or skills are installed:

text
## Active Date
2026-03-28T10:30:00Z

## Installed Skills
- todoist-sync: Bidirectional sync with Todoist tasks
- telegram-notify: Send messages to Telegram
- github-issues: List and create GitHub issues

## Active Channels
- Telegram: bot account @mybot
- WhatsApp: dedicated bot number +1-555-0123

## Enabled Tool Categories
- web_search, file_read, shell (restricted to ~/safe/)

## Models Available
- Claude Opus (Anthropic)
- GPT-4o (OpenAI, fallback)

## Agent Capabilities Declared
- Can execute: yes
- Can modify files: yes (~/workspace only)
- Can send messages: yes

## Previously Suggested / Applied
- morning-briefing: Applied 2026-03-21
- github-pr-review: Dismissed 2026-03-24
- wine-cellar: Saved (pending)

## Off-Limits Domains
- Personal email
- Production AWS access
- Browser automation on personal devices
3.4.3 Suggestion History (SUGGESTIONS_HISTORY.md)
Every time a suggestion is applied, dismissed, or saved, it's logged:

text
| Timestamp | ID | Title | Category | Status | Action |
|-----------|----|----|---------|--------|---------|
| 2026-03-21 10:30 | morning-briefing | Morning weather + tasks | Automation | Applied | - |
| 2026-03-24 14:15 | github-pr-review | PR review → Telegram | Dev | Dismissed | User found it too noisy |
| 2026-03-27 09:00 | wine-cellar | Wine collection tracker | Knowledge | Saved | Pending user decision |
When the suggestions agent researches, it reads this file and fuzzy-matches against new findings to avoid repetition.

3.4.4 Recommendations Feed UI
Layout:

text
┌─────────────────────────────────────────┐
│  Suggestions Feed                       │
│  Last refreshed: 2026-03-28 10:30 UTC   │
│  [Manual Refresh] [Settings]            │
├─────────────────────────────────────────┤
│                                         │
│  💡 NEW — 5 suggestions refreshed       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Morning Briefing                │   │
│  │ Category: Automation            │   │
│  │ Why: You use Telegram + have    │   │
│  │      no morning routine yet     │   │
│  │ Complexity: Low                 │   │
│  │                                 │   │
│  │ [Apply] [Save] [Dismiss]        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ GitHub PR → Slack Notifications │   │
│  │ Category: Dev                   │   │
│  │ Why: You have GitHub + Slack    │   │
│  │      but no PR flow yet         │   │
│  │ Complexity: Medium              │   │
│  │                                 │   │
│  │ [Apply] [Save] [Dismiss]        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Home Assistant Climate Control  │   │
│  │ Category: Home                  │   │
│  │ Complexity: High                │   │
│  │                                 │   │
│  │ ⚠️ Requires: Home Assistant     │   │
│  │ skill not yet installed         │   │
│  │                                 │   │
│  │ [Learn More] [Install Skill]    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Saved (2 items)                        │
│  ┌─────────────────────────────────┐   │
│  │ Wine Cellar Tracker             │   │
│  │ Status: SAVED 2026-03-27        │   │
│  │ [Apply Now] [Remove]            │   │
│  └─────────────────────────────────┘   │
│                                         │
Card States:

State	Icon	Behavior
new	💡	Fresh from this refresh; shows [Apply], [Save], [Dismiss]
applied	✅	User clicked Apply; shows timestamp + undo option
saved	📌	User clicked Save; moves to Saved section; survives next refresh
dismissed	✗	User clicked Dismiss; removed from feed; recorded in history
requires_setup	⚠️	Payload requires a skill/channel not yet installed; shows [Install] button
Button Actions:

[Apply] — Dispatches the payload (depends on payload_type):

prompt: Sends message to agent with payload text (e.g., "Build me a wine cellar skill with this structure: ...")

config.patch: Pushes JSON config patch via RPC

shell_command: Executes command via SSH (with user confirmation popup)

Shows spinner → ✅ / ❌ feedback → updates card state

[Save] — Moves card to saved section; records in webapp DB; survives next refresh

[Dismiss] — Hides card; records dismissal in SUGGESTIONS_HISTORY.md; agent will not re-suggest fuzzy matches

[Refresh Now] — Triggers openclaw system event --text "Refresh suggestions now" --mode now via SSH; wakes suggestions agent immediately

Manual Refresh Frequency — Configurable: every 24h, every 12h, every morning at X, etc.

4. Backend Specification
4.1 Technology Stack
Runtime: Node.js 18+

Framework: Express or Fastify (minimal overhead)

WebSocket Client: ws library (connect to OpenClaw gateway @ 127.0.0.1:18789)

SSH Client: ssh2 or node-ssh (remote command execution)

File Watching: chokidar (watch SUGGESTIONS.json for changes)

Database: SQLite (simple, zero dependencies) for saved recommendations + audit history

JSON Parsing: Native Node JSON5 support or json5 package

4.2 API Endpoints
Configuration Inspector
Endpoint	Method	Purpose	Input	Output
/api/config/raw	GET	Fetch raw openclaw.json	-	{ config: {...}, hash: "abc123" }
/api/config/explain	GET	Get human-readable config breakdown	-	{ sections: { gateway: {...}, agents: {...}, ... } }
/api/config/search	GET	Search config keys	?q=token&section=auth	{ results: [...] }
Security Audit
Endpoint	Method	Purpose	Input	Output
/api/audit/run	POST	Trigger security audit	-	{ findings: [...], status: "in_progress" }
/api/audit/findings	GET	Get latest audit findings	-	{ findings: [...], timestamp: "..." }
/api/audit/apply	POST	Apply a specific security fix	{ findingId: "..." }	{ status: "applied\|pending", error: "" }
/api/audit/dismiss	POST	Dismiss a finding as false positive	{ findingId: "..." }	{ dismissed: true }
Credentials
Endpoint	Method	Purpose	Input	Output
/api/credentials/scan	POST	Scan for plaintext secrets	-	{ plaintext: [...], secured: [...] }
/api/credentials/migrate	POST	Migrate plaintext to SecretRef	{ keyPath: "...", provider: "env", refId: "..." }	{ status: "migrated\|pending", patch: {...} }
Recommendations
Endpoint	Method	Purpose	Input	Output
/api/suggestions/list	GET	List current recommendations	?state=new\|saved\|applied	{ suggestions: [...] }
/api/suggestions/apply	POST	Apply a recommendation	{ id: "...", confirmExecution: true }	{ status: "applied", result: "..." }
/api/suggestions/save	POST	Save for later	{ id: "..." }	{ saved: true, savedAt: "..." }
/api/suggestions/dismiss	POST	Dismiss a recommendation	{ id: "..." }	{ dismissed: true }
/api/suggestions/refresh	POST	Manually trigger suggestions agent	-	{ status: "triggered", nextRefresh: "..." }
/api/suggestions/history	GET	View applied / dismissed history	?limit=50&offset=0	{ history: [...] }
Gateway Control
Endpoint	Method	Purpose	Input	Output
/api/gateway/status	GET	Get gateway health + config hash	-	{ status: "running", hash: "...", model: "...", agents: [...] }
/api/gateway/config-patch	POST	Push config.patch via RPC	{ patch: {...}, baseHash: "..." }	{ success: true, newHash: "..." }
4.3 SSH Bridge Implementation
The backend maintains a persistent SSH connection to the VPS:

javascript
// Pseudo-code
const SSHBridge = {
  async init(host, user, privateKeyPath) {
    this.client = new SSH2Client();
    await this.client.connect({ host, username: user, privateKey });
  },

  async readFile(remotePath) {
    const sftp = await this.client.sftp();
    return sftp.readFile(remotePath, 'utf-8');
  },

  async writeFile(remotePath, content) {
    const sftp = await this.client.sftp();
    return sftp.writeFile(remotePath, content);
  },

  async execCommand(command) {
    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) reject(err);
        let stdout = '', stderr = '';
        stream.on('close', () => resolve({ stdout, stderr }));
        stream.stdout.on('data', data => stdout += data);
        stream.stderr.on('data', data => stderr += data);
      });
    });
  },

  // Read openclaw.json
  async getConfig() {
    return this.readFile('~/.openclaw/openclaw.json')
      .then(text => JSON5.parse(text));
  },

  // Run security audit
  async runSecurityAudit() {
    const { stdout } = await this.execCommand(
      'openclaw security audit --deep --json'
    );
    return JSON.parse(stdout);
  },

  // Run suggestions agent refresh
  async refreshSuggestions() {
    await this.execCommand(
      'openclaw system event --text "Refresh suggestions now" --mode now'
    );
  },

  // Watch SUGGESTIONS.json for changes
  async watchSuggestions(callback) {
    // Poll every 5s for simplicity; in production use inotify if available
    setInterval(async () => {
      const current = await this.readFile(
        '~/.openclaw/agents/suggestions/SUGGESTIONS.json'
      ).catch(() => null);
      if (current && current !== this.lastSuggestions) {
        this.lastSuggestions = current;
        callback(JSON.parse(current));
      }
    }, 5000);
  }
};
4.4 WebSocket Bridge to OpenClaw Gateway
javascript
// Pseudo-code
const GatewayBridge = {
  async init(url, token) {
    this.ws = new WebSocket(url);
    this.token = token;
    this.requestId = 0;
  },

  async call(method, params) {
    const id = ++this.requestId;
    const frame = {
      jsonrpc: '2.0',
      method,
      params: { ...params, auth: { token: this.token } },
      id
    };
    this.ws.send(JSON.stringify(frame));
    return new Promise((resolve, reject) => {
      // Wait for response with matching id
      this.onMessage = (msg) => {
        const data = JSON.parse(msg);
        if (data.id === id) resolve(data.result);
      };
    });
  },

  // Fetch config with hash
  async getConfig() {
    return this.call('config.get', {});
  },

  // Patch config atomically
  async patchConfig(patch, baseHash) {
    return this.call('config.patch', {
      raw: JSON.stringify(patch),
      baseHash
    });
  }
};
4.5 Database Schema (SQLite)
sql
-- Saved recommendations
CREATE TABLE saved_suggestions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP,
  apply_count INTEGER DEFAULT 0
);

-- Audit history
CREATE TABLE audit_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finding_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  fixed_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  status TEXT DEFAULT 'open'
);

-- Dismissed suggestions
CREATE TABLE dismissed_suggestions (
  id TEXT PRIMARY KEY,
  dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT
);

-- Setup context snapshots
CREATE TABLE setup_snapshots (
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  snapshot_json TEXT NOT NULL
);
5. Frontend Specification
5.1 Technology Stack
Framework: React 18+ or Next.js (with App Router)

UI Library: Headless UI + Tailwind CSS (or similar)

State Management: TanStack Query (for server state) + Zustand/Jotai (for local state)

Real-Time Updates: socket.io-client or native WebSocket

5.2 Page Structure
text
/
├── /dashboard
│   ├── Config Inspector (collapsible tree view)
│   ├── Security Audit Summary (critical/high/medium/low counts)
│   ├── Credentials Status (plaintext count, SecretRef adoption %)
│   └── Suggestions Feed (latest 5)
│
├── /config
│   ├── Raw JSON editor
│   ├── Search/filter by key
│   ├── Annotated explanations
│   └── Edit buttons (triggers patch workflow)
│
├── /audit
│   ├── Full findings list (sortable by severity, status)
│   ├── Filter by category (gateway, auth, fs, models, etc.)
│   ├── Fix workflow (review → apply → confirm)
│   └── Audit history (dismissed, applied, pending)
│
├── /credentials
│   ├── Plaintext scan results
│   ├── Migration cards per credential
│   ├── SecretRef provider selector
│   └── Migration status tracking
│
├── /suggestions
│   ├── Active feed (new, saved, applied filters)
│   ├── Recommendation cards
│   ├── Apply/Save/Dismiss workflows
│   ├── Saved recommendations list
│   ├── History/applied log
│   └── Setup Wizard (first-time only)
│
└── /settings
    ├── SSH connection config
    ├── Suggestion refresh frequency
    ├── Notification preferences
    └── Theme toggle
5.3 Recommendation Card Component
jsx
export function SuggestionCard({ suggestion, onApply, onSave, onDismiss }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleApply = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suggestions/apply', {
        method: 'POST',
        body: JSON.stringify({ id: suggestion.id })
      });
      setResult({ ok: res.ok, message: res.ok ? 'Applied!' : 'Failed' });
      onApply(suggestion.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card border-l-4 border-blue-500 p-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-lg">{suggestion.title}</h3>
          <span className="badge badge-sm">{suggestion.category}</span>
          <span className="badge badge-sm">
            {suggestion.complexity}
          </span>
        </div>
        {suggestion.status === 'applied' && (
          <span className="badge badge-success">✓ Applied</span>
        )}
      </div>

      <p className="text-gray-600 mb-3">{suggestion.why_relevant}</p>

      <div className="flex gap-2">
        <button
          onClick={handleApply}
          disabled={loading || suggestion.status === 'applied'}
          className="btn btn-primary btn-sm"
        >
          {loading ? '...' : 'Apply'}
        </button>
        <button
          onClick={() => onSave(suggestion.id)}
          className="btn btn-outline btn-sm"
        >
          Save
        </button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="btn btn-ghost btn-sm"
        >
          Dismiss
        </button>
      </div>

      {result && (
        <div className={`mt-3 alert ${result.ok ? 'alert-success' : 'alert-error'}`}>
          {result.message}
        </div>
      )}
    </div>
  );
}
6. Security Considerations
6.1 Authentication & Authorization
SSH Key Auth: Backend uses SSH key (not password) for VPS access

Private key stored securely in webapp backend process memory

Never expose private key to frontend

Rotate SSH keys periodically

Gateway Token:

Stored in backend environment only (.env or secrets manager)

Derived from ~/.openclaw/openclaw.json on setup

Transmitted over local loopback only (127.0.0.1:18789)

Webapp Frontend Auth:

Simple token-based auth for now (e.g., ?token=xyz)

For production: OAuth2, OIDC, or Tailscale identity

Accessible only over HTTPS (via Tailscale Serve)

6.2 Data Protection
Config Files: Never expose raw secrets to frontend

Backend redacts plaintext values before sending to UI

Show only: $env:ANTHROPIC_API_KEY (not the actual key value)

SSH Credentials: Backend-only; never transmitted to frontend

Audit Findings: Safe to display (they are security insights, not secrets themselves)

6.3 Rate Limiting
Suggestions agent: 1 refresh per 24h (or manual, rate-limited to 1 per minute)

Config patches: 3 per 60 seconds (enforced by OpenClaw gateway)

Security audits: 1 per 30 minutes (to avoid load)

6.4 Rollback Plan
Every config.patch is versioned with hash-based recovery

If patch fails: backend captures error and rolls back

User can view applied changes in history and manually undo if needed

7. Deployment & Operations
7.1 Initial Setup
Backend Setup:

bash
git clone <repo>
npm install
cp .env.example .env
# Edit .env with:
# - SSH_HOST, SSH_USER, SSH_KEY_PATH
# - OPENCLAW_GATEWAY_TOKEN (from ~/.openclaw/openclaw.json)
# - WEBAPP_PORT, WEBAPP_SECRET
npm run build
npm start
Expose via Tailscale Serve:

bash
tailscale serve --set-path=/webapp localhost:3000
# Accessible at https://<device-name>-webapp.tailscale.net/
First Launch:

User visits webapp dashboard

Redirected to Setup Wizard (5 questions)

Wizard generates HEARTBEAT.md and sets up suggestions agent

Dashboard populates with initial data

7.2 Monitoring & Logs
Backend logs all API calls, SSH commands, config patches

Log rotation: keep 7 days of logs

Error tracking: capture and display fatal errors to user (with support link)

7.3 Updates & Maintenance
Suggestions agent auto-updates CURRENT_SETUP.md on every config change

Manual audit/suggestions refresh buttons for on-demand updates

Periodic SSH connection health check (reconnect on failure)

8. Phased Rollout
Phase 1 (MVP) — Weeks 1-2
Config Inspector panel (read-only)

Security Audit (run audit, display findings, manual remediation steps)

Gateway status + basic health check

Phase 2 — Weeks 3-4
One-click security fixes (config.patch auto-generation)

Credentials Hygiene panel (plaintext detection + SecretRef migration)

Audit history tracking

Phase 3 — Weeks 5-6
Setup Wizard (5-question onboarding)

Suggestions agent integration (heartbeat + SUGGESTIONS.json watcher)

Recommendations feed (Apply, Save, Dismiss, Refresh buttons)

Phase 4 (Polish) — Week 7
UI refinements, accessibility audit

Documentation + tooltips

Performance optimization (caching, polling intervals)

9. Success Metrics
Time to first suggestion: < 5 minutes from app launch

One-click fix success rate: > 95% (security fixes apply correctly)

Suggestion relevance: User finds ≥ 1 actionable suggestion per week

False positive rate: < 10% of dismissed items are legitimate suggestions

User engagement: ≥ 50% of suggestions result in Apply or Save action

Config transparency: User can explain their setup after viewing Config Inspector

10. Future Enhancements (Post-MVP)
AI-powered config optimization suggestions (e.g., "Consider enabling X for better Y")

Integration with ClawHub skill marketplace (one-click skill installation)

Agent performance metrics + usage analytics

Multi-agent comparison dashboard

Skill troubleshooting agent (if agent behaves unexpectedly, suggest diagnostics)

Webhooks for external integrations (Slack alerts on audit failures, etc.)

