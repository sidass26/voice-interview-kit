@AGENTS.md

# Travel Interview — Project Context

## What This Is

An internal tool for [Your Company] that interviews employees about their recent trips using AI voice, then generates first-person travel articles from the interview. Built to scale travel content production without professional writers.

**Flow:** Employee fills intake → AI researches destination → Voice interview (15–20 min) → Pipeline generates article → Review & publish to WordPress.

**Live URL:** https://your-app.vercel.app (no login required — share URL internally)

**Flow diagram:** https://your-app.vercel.app/flow-diagram.html

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Voice Interview | OpenAI Realtime API (gpt-4o-realtime-preview) via WebRTC |
| Research + Processing | OpenAI gpt-4.1 (Responses API + Chat API) |
| Deployment | Vercel |

---

## Environment Variables

Create `.env.local` in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
OPENAI_API_KEY=<sk-proj-...>
```

Get keys from: Supabase dashboard → Project Settings → API, and OpenAI platform.

---

## Running Locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

**Voice interviews MUST be tested in Chrome at localhost:3000.** The embedded preview browser cannot grant microphone permissions. Never test voice in VS Code's preview panel.

---

## Database

**Supabase project:** `YOUR_PROJECT_REF`

### Tables

| Table | Purpose |
|-------|---------|
| `interview_sessions` | Root entity, tracks status through 7 states |
| `intake_responses` | Employee info + trip itinerary (day-by-day JSONB) |
| `research_snapshots` | Destination research output (food hints, Reddit questions, city tips) |
| `transcripts` | Raw transcript entries + AI-cleaned text |
| `article_drafts` | Versioned article content + extraction JSON |
| `output_payloads` | WordPress-ready payload (title, slug, HTML, tags, meta) |

### Session status flow
```
intake → researching → ready → interviewing → processing → completed
                                                         ↘ failed
```

### Migrations
All migrations are in `supabase/migrations/`. Both have been applied to production:
- `001_initial_schema.sql` — All 7 tables
- `002_add_itinerary.sql` — Adds `itinerary JSONB` and `trip_duration_days INT` to `intake_responses`

To apply a new migration: run the SQL directly in Supabase SQL editor (no CLI needed for now).

---

## Architecture

### Phase 1: Intake
- Employee fills 2-step form: basic info → day-by-day itinerary builder
- Each day has a city + optional notes ("arrived late, explored old market")
- Unique cities are auto-extracted from the itinerary
- On submit: session created, intake saved, research triggered async

### Phase 2: Research (blocks interview start)
- OpenAI gpt-4.1 with `web_search_preview` tool searches Reddit + travel forums
- Returns structured hints per topic bucket (food, budget, logistics, mistakes…) + per-city tips + Reddit questions
- **"Start Interview" is DISABLED until research completes** — this is intentional (see Critical Decisions)
- Status: `researching` → `ready` when done

### Phase 3: Voice Interview
- Client fetches ephemeral token from `/api/sessions/[sessionId]/realtime`
- Server bakes full instructions (persona + intake context + itinerary + research) into the token
- Client connects directly to OpenAI Realtime via WebRTC — server is NOT in the audio path
- Bot interviews using a 5-phase structure: overview → day-by-day walk-through → cross-cutting themes → research rapid fire → close
- Transcript entries are PATCH'd to server as they arrive
- After interview: pipeline triggered automatically

### Phase 4: Processing Pipeline (5 steps)
1. **Clean transcript** — AI polishes raw entries into readable dialogue
2. **Extract data** — gpt-4.1 pulls structured facts (highlights, food, restaurants, budget, per-day breakdown)
3. **Generate article** — gpt-4.1 writes first-person travel article from extracted data
4. **Build payload** — assembles WordPress-ready JSON (title, slug, HTML, tags, categories, meta)
5. **Store** — versioned article draft + payload saved to DB

---

## Key Files

```
src/
├── app/
│   ├── page.tsx                              # Home — session list
│   ├── intake/page.tsx                       # New interview form
│   ├── interview/[sessionId]/page.tsx        # Live voice interview
│   ├── review/[sessionId]/page.tsx           # Results + article review
│   └── api/sessions/
│       ├── route.ts                          # POST: create session + trigger research
│       └── [sessionId]/
│           ├── route.ts                      # GET: full data, PATCH: append transcript
│           ├── realtime/route.ts             # GET: ephemeral OpenAI token (CRITICAL)
│           ├── research/route.ts             # GET: research snapshot or 'pending'
│           └── process/route.ts             # POST: trigger processing pipeline
├── components/
│   ├── intake-form.tsx                       # 2-step wizard with itinerary builder
│   ├── interview-panel.tsx                   # Voice UI (2-col: transcript + sidebar)
│   └── review-panel.tsx                     # Article review UI
└── lib/
    ├── types.ts                              # All TypeScript interfaces
    ├── orchestration/
    │   ├── session-manager.ts               # All DB CRUD
    │   ├── instruction-builder.ts           # Assembles AI system prompt
    │   └── topic-tracker.ts                 # Topic coverage rules
    ├── processing/
    │   ├── pipeline.ts                      # 5-step post-interview orchestrator
    │   ├── transcript-cleaner.ts
    │   ├── extractor.ts
    │   ├── article-generator.ts
    │   └── payload-builder.ts
    ├── prompts/
    │   ├── interviewer.ts                   # Persona + context builders (functions, not constants)
    │   ├── extraction.ts                    # Anti-hallucination extraction prompt
    │   ├── article.ts                       # Article generation prompt
    │   ├── research.ts                      # Destination research prompt
    │   └── transcript-cleanup.ts
    └── research/
        └── research-service.ts             # Destination research (Responses API + web search)
```

---

## Critical Design Decisions — Do Not Revert

### 1. `input_audio_transcription` in Realtime session config
**File:** `src/app/api/sessions/[sessionId]/realtime/route.ts`

```ts
input_audio_transcription: { model: 'gpt-4o-mini-transcribe' }
```

**Without this, OpenAI never fires `conversation.item.input_audio_transcription.completed` events.** Only bot speech gets transcribed. The user's entire side of the conversation is missing. The extraction model then hallucinates user answers from context (bot asked "did you try the shuwa?" → extractor infers shuwa was eaten). This was the root cause of the hallucination problem. Do not remove this field.

### 2. Research blocks interview start — do not make parallel
Research is triggered async after session creation, but the interview page polls `/api/sessions/[sessionId]/research` every 3 seconds and keeps "Start Interview" disabled until status is `ready`. This guarantees research context is baked into the system prompt from question 1. Previously research ran in parallel — sometimes the interview started with no research, producing generic questions and worse content.

### 3. Interviewer persona is a function, not a constant
`buildInterviewerPersona(destination, cities)` in `src/lib/prompts/interviewer.ts` takes the destination at runtime. The persona frames the bot as a colleague who "has been dying to visit" that specific place and wants real trip intel. This makes the interview feel natural rather than like a questionnaire.

### 4. Evidence log in extraction — do not remove
`src/lib/prompts/extraction.ts` requires every extracted fact to cite a verbatim interviewee quote in `_evidenceLog`. This prevents the extractor from treating interviewer questions as facts. Without it: bot asks "did you enjoy the spice market?" → extractor infers "visited spice market" as a highlight even if the user said nothing.

### 5. Null budget = not mentioned, never estimate
Budget fields in `ExtractedData.budgetBreakdown` are `string | null`. If budget wasn't discussed, fields stay null. The article generator skips budget sections with null values. Do not change this to empty strings or estimates.

### 6. Research uses `responses.create()` not `chat.completions.create()`
`src/lib/research/research-service.ts` uses `openai.responses.create()` with `tools: [{ type: 'web_search_preview' }]`. This is OpenAI's Responses API — a different endpoint than standard chat completions. It enables live web search during the research call. Do not swap to `chat.completions.create()` — it doesn't support web search tools.

### 7. No server-side WebRTC
The server only provides an ephemeral token. The browser connects directly to OpenAI Realtime. Transcript entries are saved client-side and PATCH'd to the server. This means if the browser tab closes mid-interview, partial transcript is still saved up to the last PATCH.

---

## Known Issues & Gotchas

- **Mic permissions**: Always test in Chrome at localhost:3000. The embedded VS Code preview browser blocks mic access. The app will show a clear error if mic is denied.
- **Research can fail silently**: If the research API call errors, the session stays in `researching` status and the interview page will spin forever. Check the server logs / Supabase `interview_sessions.notes` for errors. Workaround: manually update `status` to `ready` in Supabase and re-trigger research.
- **Transcript PATCH race**: If multiple transcript entries arrive rapidly, PATCHes may arrive out of order. The `appendTranscriptEntries` function appends rather than sets, so no data is lost — but ordering may be slightly off in the raw view.
- **Article versioning**: Each time you hit "Re-process", a new `article_drafts` row is created. The review page shows the latest version. Old versions are not deleted — useful for comparing runs.
- **No auth**: The app is intentionally auth-free for internal use. All sessions are visible to anyone with the URL. Add Supabase RLS + auth if this ever goes beyond internal use.
- **Realtime model**: Currently using `gpt-4o-realtime-preview`. OpenAI periodically updates what this points to — pin to a specific date-versioned model ID if stability is needed.

---

## Deploying

The app is deployed on Vercel connected to the GitHub repo.

```bash
# Deploy to production
vercel deploy --prod
```

Env vars are configured in Vercel dashboard → Project Settings → Environment Variables. Same 4 vars as `.env.local`.

For the Vercel deploy to work without a `vercel.json`, the project is detected as Next.js automatically. No special config needed.

---

## Product Roadmap (context from original build)

- **WordPress integration**: The `output_payloads` table already stores a WordPress-ready payload. Next step is a publish button that POSTs to the WordPress REST API.
- **Article spin-offs**: The extraction prompt generates `suggestedArticles` (e.g. "Budget guide to Oman", "Food lover's guide to Muscat"). These are stored in `article_drafts.extraction_data`. UI for selecting and generating spin-off articles is not built yet.
- **Per-city article splits**: For multi-city trips, each city block could become its own article. The itinerary structure already supports this.
- **Review/edit UI**: The review page shows the generated article but editing is basic. A proper rich text editor (Tiptap/Lexical) would improve the review workflow.
- **Interview quality scoring**: Track how many mandatory topics were covered, how long the interview ran, how many transcript entries the interviewee had vs. the bot. Use this to flag thin interviews before processing.
