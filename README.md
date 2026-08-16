# voice-interview-kit

**A kit for building voice AI agents that interview people and turn the conversation into publishable content.**

One 15-minute voice interview produces roughly 1,500–2,500 words of first-party editorial — grounded in what the interviewee actually said, with images placed, and shaped into a payload your CMS can accept.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/architecture-dark.svg">
  <img alt="System architecture: a real-time audio path connects the interviewee, the browser interview UI, and the OpenAI Realtime voice model over WebRTC. An async data path connects the browser to the Next.js server for ephemeral tokens and transcript patches; the server delegates to a GPT-4.1 text model with web search, fact extraction, and article writer tools, and stores sessions, transcripts, and drafts in Supabase." src="docs/architecture-light.svg">
</picture>

## Why interview instead of generate

Generic AI writing has a structural problem: it can only recombine what's already published. It cannot report. Google's helpful-content guidance rewards demonstrated first-hand experience — the E in E-E-A-T — and that is precisely the thing a language model cannot fabricate on its own.

So this doesn't generate content. It **interviews a human who has the experience**, then does the work of turning speech into structure.

The engineering follows from that premise:

- **Every extracted fact must cite a verbatim quote from the interviewee.** The extraction step maintains an evidence log; a claim with no supporting quote doesn't survive. This exists because without it, the extractor infers answers from the interviewer's *questions* — the bot asks "did you try the shuwa?" and the article confidently reports that you did.
- **Anything not discussed stays `null`.** Budget wasn't mentioned? The article skips budget. Nothing is estimated, inferred, or padded.
- **Research runs before the interview, not during.** The agent arrives already knowing what to ask about, so you get specifics instead of "so, tell me about your trip."

The output is content only that person could have produced. That's the point.

## What comes out

| Artifact | Detail |
|---|---|
| Article | ~1,500–2,500 words, first-person, from the interviewee's own account |
| Structured extraction | Typed facts with an evidence log tying each to a quote |
| Images | Uploaded photos curated by a separate pipeline — featured image selected, placements chosen against article structure |
| CMS payload | Title, slug, HTML, excerpt, tags, categories, meta — WordPress-shaped, connector-ready |
| Transcript | Raw entries plus a cleaned, readable version |

## How it works

1. **Intake** — the subject fills a short form defining who they are and what the interview is about.
2. **Research** — GPT-4.1 with live web search builds an interview brief: what to probe, what the community argues about, what specifics to chase. The interview stays locked until the brief lands, so the agent is never asking generic questions.
3. **Voice interview** — the browser mints an ephemeral OpenAI Realtime token with the full agent prompt baked in, then streams audio peer-to-peer. **The server is never in the audio path** — no proxy latency, and transcripts survive a closed tab because they're patched as they arrive.
4. **Pipeline** — clean transcript → extract structured facts with evidence → generate the article → curate images → build the CMS payload → store, versioned.
5. **Review & publish** — review the draft, then push to your CMS.

Architecture detail and the reasoning behind each decision: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). An interactive flow walkthrough ships at `/flow-diagram.html`.

## Building your own agent

The kit separates the **engine** (WebRTC session handling, orchestration, pipeline, persistence) from the **domain** ([`interview.config.ts`](interview.config.ts)), which declares your intake fields, interviewer persona, interview phases, extraction schema, outputs, and connectors.

**Travel Stories is the reference implementation** — interview employees about trips, get travel articles. It's fully working, and it's the worked example for the config surface.

### Status — what's wired

Being straight about this, because the config layer looks more finished than it is.

**Working:** the full pipeline end to end; research, persona, extraction, and article prompts all driven by config; model, voice, and transcription settings config-driven; intake form and intake persistence being generalized right now.

**Not yet wired:** `branding`, `subject.label`, `interview.phases`, `connectors`, and `campaigns` are declared and typed but not yet read by the engine — the UI still hardcodes travel equivalents. Topic tracking uses a hardcoded checklist rather than `config.interview.phases`.

**So adopting this for a different domain today means engine work, not just a new config file.** The parts already domain-agnostic and safe to build on: the [`InterviewContext`](src/lib/config/types.ts) contract, plus `extractor.ts`, `article-generator.ts`, `research-service.ts`, and the realtime token route. Progress and ordering in the [Roadmap](#roadmap).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Voice | OpenAI Realtime API over WebRTC |
| Research + processing | OpenAI GPT-4.1 (Responses API with web search + Chat API) |
| Images | sharp + Supabase Storage |
| Hosting | Vercel, or anywhere Next.js runs |

## Quickstart

```bash
git clone https://github.com/sidass26/voice-interview-kit.git
cd voice-interview-kit
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

Create a Supabase project and run each file in [`supabase/migrations/`](supabase/migrations) (001 → 004, in order) in the SQL editor.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) **in Chrome** — voice needs microphone permissions, and embedded preview browsers (VS Code panels and similar) block mic access.

> **Cost:** each interview spends real OpenAI credits — a ~15-minute Realtime voice session plus the research call and five pipeline steps. Watch your usage on the first few runs before turning anyone loose on it.

## Deploying

Standard Next.js deploy. On [Vercel](https://vercel.com): import the repo, add the same four environment variables, done.

> **No auth.** The app ships auth-free — anyone with the URL sees every session. Add authentication and Supabase RLS before putting it anywhere public.

## Roadmap

Toward a genuinely config-driven kit, in dependency order:

1. 🚧 Render intake dynamically from `config.intake.fields`; make the repeating section optional
2. 🚧 Persist intake to the generic `data JSONB` column
3. Guard the payload builder against non-travel extraction shapes
4. Drive topic tracking from `config.interview.phases` instead of a hardcoded checklist
5. Read `config.branding` in the UI instead of hardcoded strings
6. Ship an `examples/` directory with a non-travel reference config
7. Test coverage — currently none, and it's the main thing blocking safe contribution

Also planned: one-click CMS publishing via the connector layer, spin-off articles from a single interview, and interview quality scoring to flag thin sessions before they reach the pipeline.

## Contributing

Issues and PRs welcome — particularly on the roadmap items above. The codebase has no test coverage yet, so please describe how you verified any change.

## License

[MIT](LICENSE)
