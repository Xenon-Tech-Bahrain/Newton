# Newton

Newton is Xenon Tech's B2B workspace: Notion-style documents, Teams-style channels,
tasks, and **Aria**, an AI assistant that can read images and fetch web pages.

Newton is **source-available** under the [PolyForm Noncommercial License 1.0.0](LICENSE):
you can read, run, change and share the source for any noncommercial purpose.
Commercial use needs a paid Newton plan — see [Licence](#licence).

- Hosted product: <https://newtonbh.vercel.app>
- Company: <https://xenonbh.vercel.app>
- **Install guide: [INSTALL.md](INSTALL.md)**

## What this repository is

This is the source of Newton's application layer: the product pages, the workspace
UI, the HTTP API, the Aria pipeline and the database migrations that back them.

The published source is **source-available, not open source**. PolyForm
Noncommercial deliberately withholds the commercial-use right that an open-source
licence would grant.

Newton runs on the **Xenon platform runtime** — account identity (Xenon EcoAccount),
session handling, the PostgreSQL client, migrations runner, email transport, rate
limiting and the admin console. That runtime is proprietary and is **not** part of
this repository. As a result this repository is a source publication, not a
self-contained build: `npm install && npm run build` will not produce a working
Newton without the runtime.

If you want a local instance, use **Newton Local Edition**, which ships as part of
the Xenon platform distribution and starts a local server on
`http://localhost:2026` with an EULA gate and a provider of your choice.

## Layout

```
app/newton/                 product page, pricing, and the signed-in workspace
app/api/newton/             threads, messages, attachments, documents, tasks, teams
components/newton/          workspace UI: chat, composer, documents, tasks, teams
lib/newton/                 config, Aria prompt, Gemini transport, service layer
db/migrations/0010..0017    Newton schema: threads, attachments, plans, workspace objects
.env.example                provider and limit settings for a local instance
```

## Aria

Aria is the assistant inside Newton. Text turns are answered by a small, fast model;
turns that carry an image are routed to a vision model. The provider is Google
Gemini, called with plain `fetch` — no AI SDK dependency.

- `lib/newton/gemini.ts` converts OpenAI-shaped messages into Gemini's format and
  bridges Gemini's stream back into the event shape the chat route already emits.
- `lib/newton/aria.ts` holds the system prompt and the stream reader.
- `app/api/newton/threads/[id]/messages/route.ts` opens the provider stream before
  writing to the database, so a provider outage returns a clean JSON error instead of
  a half-written turn. It emits `meta`, `delta`, `done` and `error` events as SSE and
  persists the reply when the stream ends.
- Attachments are uploaded first and referenced by opaque id. Image bytes are read
  server-side; inline data URLs from the client are ignored.
- Replies render as plain text with `whitespace-pre-wrap`. There is no markdown or
  HTML renderer, so model output cannot inject markup.

## Configuration

Copy `.env.example` and set one provider key. Limits (messages per day, tokens per
day, requests per minute, prompt size, history depth, completion tokens, saved
chats) are environment-tunable and documented in the file.

## Security

- Every Newton route requires an authenticated account, and thread ownership is
  checked before any provider call.
- CSRF protection is required on mutating requests.
- Quotas and rate limits run before the provider call so a scripted client cannot
  burn the budget.
- Conversations are deleted, not anonymised, when an account is deleted.
- Secrets are read only by server code.

## Contributing

Newton is maintained by Xenon Tech. See [CONTRIBUTORS.md](CONTRIBUTORS.md).

## Trademarks

"Newton", "Aria" and "Xenon Tech" are trademarks of Xenon Tech. The PolyForm
Noncommercial License 1.0.0 grants no trademark rights.

## Licence

[PolyForm Noncommercial License 1.0.0](LICENSE). See [NOTICE](NOTICE) for
attribution.

### What you may do

For any **noncommercial** purpose — personal study, hobby projects, research,
testing, and use by charities, schools, public research bodies, public safety and
health organisations, environmental organisations and government institutions —
you may read, run, copy, change and share this source, provided recipients also
get the licence and the required notice.

### What needs a paid plan

Commercial use — using Newton in a business, for revenue, or to deliver paid work
to clients — is **not** granted by this licence. That needs a Newton Pro, Max or
Enterprise plan, or a separate written commercial licence from Xenon Tech:

- Hosted, no install: <https://newtonbh.vercel.app>
- Licensing enquiries: <xenontechbahrain@gmail.com>

### Why this is not "open source"

The Open Source Definition forbids restricting a field of use such as
commerciality. PolyForm Noncommercial restricts exactly that, so the correct term
is *source-available*. Xenon Tech publishes the code so you can audit it and build
on it yourself; it does not give away the right to sell it.

### Scope

This licence covers the files in this repository. It does not cover the Xenon
platform runtime, the hosted service, Aria as operated by Xenon Tech, or the
Xenon Tech trademarks.
