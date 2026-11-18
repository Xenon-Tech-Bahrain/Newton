# Install Newton

Three ways to run Newton. Pick the one that matches what you have.

| You want | Use | Time |
| --- | --- | --- |
| Newton without installing anything | [Hosted service](#1-hosted-service-no-install) | 1 minute |
| Newton on your own machine | [Newton Local Edition](#2-newton-local-edition) | 15 minutes |
| To read or rebase on the source | [Source](#3-build-from-source) | - |

## What Newton needs

| Requirement | Version | Notes |
| --- | --- | --- |
| Node.js | 20.9 or newer | 22 LTS recommended |
| PostgreSQL | 14 or newer | Any host. A free Neon/Supabase database works. |
| An AI provider key | - | Google Gemini is the supported provider today, and it is the only one Aria talks to. |

Newton's application code is in this repository. The runtime it imports —
account identity, sessions, the database client, the migrations runner, email and
the admin console — is part of the Xenon platform and is not published here. That
is why Option 3 cannot produce a working server on its own.

---

## 1. Hosted service (no install)

Sign in at <https://newtonbh.vercel.app>. Nothing to install, no key, no database.

---

## 2. Newton Local Edition

Newton Local Edition is the local launcher that ships with the Xenon platform
distribution. It shows the EULA once, applies migrations, and serves Newton on
`http://localhost:2026`.

### Step 1 - Get the platform

You need access to the Xenon platform repository. Ask Xenon Tech to grant it, then:

```bash
git clone https://github.com/Xenon-Tech-Bahrain/xenon-platform.git
cd xenon-platform
npm install
```

### Step 2 - Create a database

Use a hosted database (simplest):

1. Create a project at <https://neon.tech> (free tier is enough).
2. Copy the **pooled** connection string.
3. Append `?sslmode=require` if it is not already there.

Or run PostgreSQL locally with Docker:

```bash
docker run --name newton-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=xenon \
  -p 5432:5432 \
  -d postgres:16
```

That gives you `postgresql://postgres:postgres@localhost:5432/xenon?sslmode=disable`.

### Step 3 - Configure

```bash
cp .env.local.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.local.example .env
```

Open `.env` and set two values:

```dotenv
DATABASE_URL="postgresql://user:password@host:5432/xenon?sslmode=require"
GEMINI_API_KEY="your-key-from-https://aistudio.google.com/apikey"
```

Migrations run automatically on start. Set `NEWTON_SKIP_MIGRATE=1` to skip them.

### Step 4 - Start

```bash
npm run newton:local
```

On the first run you get the EULA. Read it and type `accept`:

```
Do you accept these terms? Type 'accept' to continue: accept
```

Acceptance is stored in `.newton-local/.eula-accepted`. You are only asked once.

Expected output:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PROVIDER DETECTED: Google Gemini                                            │
│  Model: gemini-3.5-flash-lite                                                │
└──────────────────────────────────────────────────────────────────────────────┘

🗄  Database: ep-xxx-pooler.region.aws.neon.tech:5432/neondb (sslmode=require)
→ Applying database migrations...
applied 0001_xenon_schema
...
🚀 Starting Newton Local Edition on http://localhost:2026
```

### Step 5 - Open it

Go to **<http://localhost:2026>** and sign in with your Xenon EcoAccount, then
open the Aria workspace and send a message.

Stop the server with `Ctrl+C`. Your data stays in the database, so the next start
resumes where you left off.

---

## 3. Build from source

This repository publishes Newton's application layer. It does not include the
Xenon runtime, so a bare `npm install && npm run build` cannot produce a working
server. Read this section as an orientation, not a recipe.

What is here:

```
app/newton/                 product page, pricing, and the signed-in workspace
app/api/newton/             threads, messages, attachments, documents, tasks, teams
components/newton/          workspace UI
lib/newton/                 config, Aria prompt, Gemini transport, service layer
db/migrations/0010..0017    Newton schema
.env.example                provider, database and limit settings
```

What Newton imports from the runtime, and you must supply:

| Module | Responsibility |
| --- | --- |
| `@/lib/db` | PostgreSQL pool and transaction helper |
| `@/lib/account/auth` | session resolution for API routes |
| `@/lib/admin/*` | id generation, rate limiting, moderation helpers |
| `@/lib/email/transport` | outbound mail for invites and notifications |
| `@/lib/site-config` | site URLs and copy |

If you are rebuilding Newton elsewhere, provide those modules with the same
signatures, point `DATABASE_URL` at PostgreSQL, run the migrations in order, and
serve the app with Next.js 16.

---

## Environment reference

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. `APP_DATABASE_URL` takes precedence if set. |
| `DATABASE_SSL` | No | `require` (default for remote hosts), `no-verify` for self-signed certificates, `disable` for local servers. |
| `GEMINI_API_KEY` | For Aria | Google Gemini key. Server-side only. |
| `GEMINI_TEXT_MODEL` | No | Defaults to `gemini-3.5-flash-lite`. |
| `GEMINI_VISION_MODEL` | No | Model used when a message carries an image. Defaults to `gemini-3.5-flash`. |
| `NEWTON_MODEL` | No | Local Edition display override for the detected provider. |
| `AUTH_SECRET` | No | Session signing secret. Local Edition generates a development value if unset. |
| `NEWTON_SKIP_MIGRATE` | No | Set to `1` to skip automatic migrations. |

### Provider detection

Local Edition detects these variables, in this order, and reports the first one it
finds:

`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`,
`OLLAMA_HOST`, `OPENROUTER_API_KEY`, `CUSTOM_API_KEY`.

Only Gemini is wired to Aria today. If you set another provider, the launcher
reports it, but Aria replies will fail until a transport for that provider exists.
Set `GEMINI_API_KEY` to get a working assistant.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `NO DATABASE CONFIGURED` | `DATABASE_URL` missing | Set it in `.env` or the environment. |
| `Migration failed: connect ECONNREFUSED` | Database not reachable | Check the host, port and that the server is running. |
| `self signed certificate` | TLS verification | Set `DATABASE_SSL=no-verify`. |
| `password authentication failed` | Wrong credentials | Re-copy the connection string, including the database name. |
| Port 2026 already in use | Another instance is running | Stop it: `npx kill-port 2026`, or restart your machine. |
| Aria says it had a temporary problem | No usable provider key | Set `GEMINI_API_KEY` and restart. |
| EULA prompt keeps appearing | Marker missing | Check `.newton-local/` is writable. |
| Migrations are slow on first start | Empty database | Expected. They run once. |

## Reset or uninstall

Stop the server, then:

1. Delete the Newton tables, or drop the database you created for it.
2. Delete `.newton-local/` to be asked for EULA acceptance again.
3. Delete `.env` to remove your keys from this checkout.

Nothing is written to the Xenon project directory outside `.newton-local/` and
`node_modules/`.

## Licence and support

Newton is source-available under the [PolyForm Noncommercial License
1.0.0](LICENSE): noncommercial use, modification and sharing are permitted;
commercial use needs a paid plan or a separate commercial licence. Newton Local
Edition is part of the Xenon platform and is covered by the EULA you accept on
first run.

Support: <https://xenonbh.vercel.app/contact>
