# voice-interview-kit

A config-driven kit for **AI voice interviews that turn into publish-ready content**. An AI interviewer calls your subject in the browser, has a natural 15–20 minute conversation, and a processing pipeline converts the transcript into structured facts and a first-person article — ready to review and publish.

Ships with a complete **Travel Stories** example: interview employees about their recent trips, get travel articles out.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.svg">
  <img alt="System architecture: a real-time audio path connects the interviewee, the browser interview UI, and the OpenAI Realtime voice model over WebRTC. An async data path connects the browser to the Next.js server for ephemeral tokens and transcript patches; the server delegates to a GPT-4.1 text model with web search, fact extraction, and article writer tools, and stores sessions, transcripts, and drafts in Supabase." src="docs/architecture-light.svg">
</picture>

The key idea (borrowed from how modern realtime voice stacks are built): **audio never waits for reasoning.** The browser talks to OpenAI Realtime directly over WebRTC — the server is never in the audio path. Everything heavy (research, orchestration, the processing pipeline) happens on the async path alongside the conversation. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); an interactive flow walkthrough ships with the app at `/flow-diagram.html`.

## How it works

1. **Intake** — the subject fills a short form (fields defined in config). A session is created.
2. **Research** — GPT-4.1 with live web search builds an interview brief: topic hints, community questions, per-city tips. The interview can't start until the brief is ready — so the AI asks informed questions from minute one.
3. **Voice interview** — the browser fetches an ephemeral OpenAI Realtime token with the full interviewer prompt (persona + intake + research) baked in, then streams audio peer-to-peer. Transcripts are saved to the server as they arrive.
4. **Processing pipeline** — clean transcript → extract structured facts (every fact must cite a verbatim quote — no hallucinated answers) → generate article → build publish payload → store.
5. **Review & publish** — review the draft in the app; the output payload is publish-ready JSON (WordPress-shaped by default).

## Make it yours

Everything domain-specific lives in one file: [`interview.config.ts`](interview.config.ts).

- **Branding** — app name, tagline, colors
- **Intake form** — the fields your use case needs
- **Interview** — phases, persona, models, voice
- **Prompts** — research, extraction, and article builders
- **Outputs** — what the pipeline should produce

The engine (WebRTC session handling, Supabase persistence, pipeline plumbing) is generic and reads the config at runtime. Swap the config, get a different product: customer-discovery interviews, exit interviews, user research, oral history — anything that's "talk to a person, get structured content out."

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
git clone https://github.com/YOUR_USERNAME/voice-interview-kit.git
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

## Deploying

Deploys as a standard Next.js app. On [Vercel](https://vercel.com): import the repo, add the same 4 environment variables, done. No special config needed.

> **Note:** the app ships auth-free (built for internal use — anyone with the URL sees all sessions). Add auth + Supabase RLS before exposing it publicly.

## Roadmap

- One-click publish to WordPress (the payload is already WordPress-shaped)
- Spin-off articles from one interview (the extractor already suggests them)
- Per-city / per-topic article splits
- Rich text editing in the review UI
- Interview quality scoring (flag thin interviews before processing)

## License

[MIT](LICENSE)
