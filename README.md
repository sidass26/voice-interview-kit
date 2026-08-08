# voice-interview-kit

**AI voice interviews that turn into publish-ready articles.** An AI interviewer talks to someone in the browser for 15–20 minutes, then a processing pipeline converts the transcript into structured facts and a first-person article — ready to review and publish.

The working use case is **Travel Stories**: interview employees about their recent trips, get travel articles out. A configuration layer for other use cases is in progress — see [Status](#status) before you plan around it.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.svg">
  <img alt="System architecture: a real-time audio path connects the interviewee, the browser interview UI, and the OpenAI Realtime voice model over WebRTC. An async data path connects the browser to the Next.js server for ephemeral tokens and transcript patches; the server delegates to a GPT-4.1 text model with web search, fact extraction, and article writer tools, and stores sessions, transcripts, and drafts in Supabase." src="docs/architecture-light.svg">
</picture>

The key idea (borrowed from how modern realtime voice stacks are built): **audio never waits for reasoning.** The browser talks to OpenAI Realtime directly over WebRTC — the server is never in the audio path. Everything heavy (research, orchestration, the processing pipeline) happens on the async path alongside the conversation. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); an interactive flow walkthrough ships with the app at `/flow-diagram.html`.

## How it works

1. **Intake** — the traveler fills a short form: trip basics, then a day-by-day itinerary.
2. **Research** — GPT-4.1 with live web search builds an interview brief: topic hints, community questions, per-city tips. The interview can't start until the brief is ready, so the AI asks informed questions from minute one.
3. **Voice interview** — the browser fetches an ephemeral OpenAI Realtime token with the full interviewer prompt (persona + intake + research) baked in, then streams audio peer-to-peer. Transcripts save to the server as they arrive.
4. **Processing pipeline** — clean transcript → extract structured facts (every fact must cite a verbatim quote, so nothing is invented) → generate article → build publish payload → store.
5. **Review & publish** — review the draft in the app; the output payload is publish-ready JSON (WordPress-shaped).

## Status

Being honest about what works, because the config layer looks more finished than it is.

**Works today**
- The full travel pipeline, end to end: intake → research → voice interview → article → review
- Model, voice, and prompt configuration via `interview.config.ts` (research prompt, interviewer persona, extraction schema, article prompt)

**Not yet wired**
- `interview.config.ts` declares branding, intake fields, subject labels, interview phases, connectors, and campaigns — **most of these are not read by the engine yet.** The type system is in place; the wiring isn't.
- The intake form ([`intake-form.tsx`](src/components/intake-form.tsx)) renders hardcoded travel inputs rather than reading `config.intake.fields`, and its itinerary builder is mandatory.
- Intake persists to travel-specific database columns; the generic `data JSONB` column from migration 004 isn't used yet.

**So: adopting this for a non-travel use case needs engine work, not just a new config file.** The generic parts to build on are `InterviewContext` ([config/types.ts](src/lib/config/types.ts)) and four already domain-agnostic files: `extractor.ts`, `article-generator.ts`, `research-service.ts`, and the realtime token route. Contributions welcome — see [Roadmap](#roadmap).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Voice | OpenAI Realtime API via WebRTC |
| Research + processing | OpenAI GPT-4.1 (Responses API with web search + Chat API) |
| Hosting | Vercel (or anywhere Next.js runs) |

## Quickstart

```bash
git clone https://github.com/sidass26/voice-interview-kit.git
cd voice-interview-kit
npm install
cp .env.example .env.local
```

Fill in `.env.local` (4 keys):

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

Set up the database: create a Supabase project, then run each file in [`supabase/migrations/`](supabase/migrations) (001 → 004, in order) in the Supabase SQL editor.

Run it:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) **in Chrome** — voice interviews need microphone permissions, and embedded preview browsers (VS Code panels, etc.) block mic access.

> **Heads up:** running an interview costs OpenAI credits — a Realtime voice session plus the research and pipeline calls. Watch your usage on the first few runs.

## Deploying

Deploys as a standard Next.js app. On [Vercel](https://vercel.com): import the repo, add the same 4 environment variables, done. No special config needed.

> **Note:** the app ships auth-free (built for internal use — anyone with the URL sees all sessions). Add auth and Supabase RLS before exposing it publicly.

## Roadmap

Toward a genuinely config-driven kit, roughly in dependency order:

1. Render the intake form dynamically from `config.intake.fields`; make the repeating section (itinerary) optional
2. Persist intake to the generic `data JSONB` column so any config's fields survive
3. Guard the payload builder against non-travel extraction shapes
4. Drive interview topic tracking from `config.interview.phases` instead of a hardcoded travel checklist
5. Read `config.branding` in the UI instead of hardcoded strings
6. Ship an `examples/` directory with at least one non-travel config, once the above works

Also planned: one-click WordPress publishing (the payload is already shaped for it), spin-off articles from a single interview, and interview quality scoring to flag thin interviews before processing.

## License

[MIT](LICENSE)
