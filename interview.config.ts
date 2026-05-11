/**
 * interview.config.ts — The single file you edit to configure your deployment.
 *
 * This file defines everything domain-specific about your interview:
 *   - Who gets interviewed and what you collect in the intake form
 *   - The AI researcher's web-search prompt
 *   - The voice bot's persona and interview structure
 *   - The extraction schema (what facts to pull from the transcript)
 *   - What output(s) to generate (article, report, summary…)
 *   - Which connectors to publish to (WordPress, Notion, Slack, webhook)
 *   - Whether to enable bulk-invite campaigns
 *
 * The engine (WebRTC, Supabase, pipeline) reads this file and never
 * hardcodes domain logic. Swap this file with one from the `examples/`
 * directory to change the entire use case without touching engine code.
 *
 * ---------------------------------------------------------------------------
 * CURRENT CONFIG: Travel Stories
 * Interviews employees about recent trips → generates first-person articles
 * ---------------------------------------------------------------------------
 */

import type { InterviewConfig, InterviewContext } from './src/lib/config/types';

// Existing prompt builders — these stay in src/lib/prompts/ and are called
// from this config. In Phase B, the engine will call config methods instead
// of these functions directly. For now they coexist.
import { buildInterviewerPersona } from './src/lib/prompts/interviewer';
import { buildResearchPrompt } from './src/lib/prompts/research';
import { buildExtractionPrompt } from './src/lib/prompts/extraction';
import { buildArticlePrompt } from './src/lib/prompts/article';

// Travel-specific types — used for casting in prompt builders below.
// Non-travel configs will import their own domain types instead.
import type { IntakeResponse, ExtractedData } from './src/lib/types';

// ---------------------------------------------------------------------------

export const config: InterviewConfig = {

  // ── Branding ──────────────────────────────────────────────────────────────
  branding: {
    appName: 'Travel Interview',
    tagline: 'Capture employee trips as first-person articles',
    primaryColor: '#6B2AEA',
  },

  // ── Subject ───────────────────────────────────────────────────────────────
  // "Who is being interviewed?" — label used throughout the UI and in prompts.
  subject: {
    label: 'Traveler',
    plural: 'Travelers',
    // Extra profile fields collected on the review page (after the interview).
    profileFields: [
      {
        id: 'role',
        label: 'Your role at [Company]',
        type: 'text',
        placeholder: 'Senior Product Manager',
      },
      {
        id: 'bio',
        label: 'Short bio',
        type: 'textarea',
        placeholder:
          "I'm a Product Manager who travels solo every few months. I care most about finding local food and avoiding tourist traps.",
        maxLength: 300,
      },
      { id: 'twitter',   label: 'Twitter / X handle', type: 'text', placeholder: '@username' },
      { id: 'instagram', label: 'Instagram handle',   type: 'text', placeholder: '@username' },
      { id: 'linkedin',  label: 'LinkedIn URL',        type: 'url',  placeholder: 'https://linkedin.com/in/...' },
    ],
  },

  // ── Intake form ───────────────────────────────────────────────────────────
  // Fields rendered in the intake form. Keep required fields minimal —
  // more fields = more friction = fewer completed interviews.
  intake: {
    subjectNameField: 'employee_name',
    topicField: 'destination_country',
    fields: [
      {
        id: 'employee_name',
        label: 'Your full name',
        type: 'text',
        placeholder: 'Alex Johnson',
        required: true,
      },
      {
        id: 'work_email',
        label: 'Work email',
        type: 'email',
        placeholder: 'jane@company.com',
        required: true,
      },
      {
        id: 'destination_country',
        label: 'Destination country',
        type: 'text',
        placeholder: 'Japan',
        required: true,
      },
      {
        id: 'trip_type',
        label: 'Trip in a nutshell',
        type: 'text',
        placeholder: '5 days in Tokyo and Kyoto, mostly food and temples',
        required: true,
      },
      {
        id: 'trip_purpose',
        label: 'Trip purpose',
        type: 'select',
        options: ['Holiday', 'Business', 'Bleisure', 'Adventure', 'Family', 'Other'],
        required: true,
      },
      {
        id: 'num_travelers',
        label: 'Number of travelers',
        type: 'number',
        min: 1,
        required: true,
      },
      { id: 'trip_start_date', label: 'Trip start date', type: 'date' },
      { id: 'trip_end_date',   label: 'Trip end date',   type: 'date' },
    ],
    // Day-by-day itinerary builder. Each row = one day.
    // Unique cities are auto-extracted and exposed as ctx.uniqueValues.cities.
    repeatingSection: {
      id: 'itinerary',
      label: 'Day-by-day itinerary',
      addButtonLabel: 'Add a day',
      itemFields: [
        {
          id: 'city',
          label: 'City',
          type: 'text',
          placeholder: 'Tokyo',
          required: true,
        },
        {
          id: 'notes',
          label: 'What happened',
          type: 'textarea',
          placeholder: 'Arrived late, explored Shibuya crossing, found great ramen...',
          maxLength: 200,
        },
      ],
      extractUniqueValues: {
        fromField: 'city',
        toContextKey: 'cities',
      },
    },
  },

  // ── Research ──────────────────────────────────────────────────────────────
  // Pre-interview AI web search. Runs async after intake submission.
  // Results are baked into the voice bot's system prompt before the interview
  // starts, giving it specific community-sourced questions to ask.
  //
  // CRITICAL: blocksInterviewStart must stay true — if the interview starts
  // without research, the bot asks generic questions and output quality drops
  // significantly. See CLAUDE.md Critical Decision #2.
  research: {
    enabled: true,
    blocksInterviewStart: true,
    systemInstructions:
      'You are a travel research assistant. Always search the web for real, current information. Focus especially on Reddit discussions for authentic traveler opinions.',
    promptBuilder: (ctx: InterviewContext): string => {
      const intake = ctx.intake as Record<string, string>;
      return buildResearchPrompt(
        intake.destination_country,
        ctx.uniqueValues.cities ?? [],
        intake.trip_type,
        intake.trip_purpose,
      );
    },
    // Mirrors the DestinationResearch interface in src/lib/types.ts.
    // Used by the engine to validate the model's JSON response at runtime.
    responseSchema: {
      destination: 'string',
      summary: 'string',
      bucketHints: {
        trip_overview:    { hints: ['string'] },
        highlights:       { hints: ['string'] },
        disappointments:  { hints: ['string'] },
        food:             { hints: ['string'] },
        restaurants:      { hints: ['string'] },
        logistics:        { hints: ['string'] },
        budget:           { hints: ['string'] },
        mistakes:         { hints: ['string'] },
        practical_tips:   { hints: ['string'] },
      },
      uniqueAngles:    ['string'],
      redditQuestions: ['string'],
      cityResearch: {
        '[city]': {
          food:           ['string'],
          activities:     ['string'],
          tips:           ['string'],
          commonMistakes: ['string'],
        },
      },
    },
  },

  // ── Interview ─────────────────────────────────────────────────────────────
  interview: {
    voice: 'alloy',
    realtimeModel: 'gpt-4o-realtime-preview',
    // CRITICAL: Never remove transcriptionModel — without it, the user's audio
    // is never transcribed and the extraction model hallucinates answers.
    // See CLAUDE.md Critical Decision #1.
    transcriptionModel: 'gpt-4o-mini-transcribe',
    targetDurationMin: 15,

    // The persona is built at session-start from live intake data.
    // It forms the opening block of the voice bot's system prompt.
    personaBuilder: (ctx: InterviewContext): string => {
      const intake = ctx.intake as Record<string, string>;
      return buildInterviewerPersona(
        intake.destination_country,
        ctx.uniqueValues.cities ?? [],
      );
    },

    // Ordered interview phases injected into the system prompt.
    // The bot receives all phases upfront and transitions naturally.
    phases: [
      {
        id: 'overview',
        label: 'Overview',
        instruction:
          'Start with trip context — how the trip came about, general vibe, initial impressions. 2-3 minutes max.',
      },
      {
        id: 'day_by_day',
        label: 'Day by day',
        instruction:
          'Walk through each city block from the itinerary in order. For each city, ask what they did, where they ate, and what stood out. Use the CITY-SPECIFIC PROBES from the research context.',
      },
      {
        id: 'themes',
        label: 'Cross-cutting themes',
        instruction:
          'Cover any mandatory topics not yet addressed: budget, negatives/disappointments, logistics, specific restaurant recs.',
      },
      {
        id: 'rapid_fire',
        label: 'Research rapid fire',
        instruction:
          'Transition with: "We did some research before this — found some common questions people ask. Quick fire round, give me short answers." Then ask every MANDATORY PHASE 4 QUESTION from the research context, one at a time.',
      },
      {
        id: 'close',
        label: 'Close',
        instruction:
          '"That\'s super helpful — thanks! One last thing — if someone at your company was planning the same trip, what\'s the one thing you\'d tell them?" Thank them and end.',
      },
    ],
  },

  // ── Extraction ────────────────────────────────────────────────────────────
  // Pulls structured facts from the cleaned transcript.
  // The _evidenceLog requirement prevents hallucination — every extracted fact
  // must cite a verbatim transcript quote. See CLAUDE.md Critical Decision #4.
  extraction: {
    requireEvidenceLog: true,
    promptBuilder: (transcript: string, ctx: InterviewContext): string => {
      const intake = ctx.intake as Record<string, string>;
      return buildExtractionPrompt(
        transcript,
        intake.destination_country,
        ctx.uniqueValues.cities ?? [],
      );
    },
  },

  // ── Outputs ───────────────────────────────────────────────────────────────
  // At least one output is required. The first is treated as the primary
  // artifact shown in the review UI.
  outputs: [
    {
      id: 'article',
      label: 'Travel Article',
      format: 'markdown',
      // Uses gpt-4.1 (default). Override with `model` to use a different one.
      promptBuilder: (
        extracted: Record<string, unknown>,
        transcript: string,
        ctx: InterviewContext,
      ): string => {
        // Cast to travel-specific types — safe here because this config
        // populates intake with the travel fields defined above.
        return buildArticlePrompt(
          extracted as unknown as ExtractedData,
          transcript,
          ctx.intake as unknown as IntakeResponse,
        );
      },
    },
  ],

  // ── Connectors ────────────────────────────────────────────────────────────
  // Set `enabled: true` and add the corresponding env vars to publish
  // automatically after each completed interview.
  //
  // Credentials live in environment variables — never hardcode them here.
  // See .env.example for the full list.
  connectors: [
    {
      id: 'wordpress',
      outputId: 'article',
      enabled: false, // set to true + add env vars to activate
      envKeys: {
        apiUrl:      'WORDPRESS_URL',
        username:    'WORDPRESS_USERNAME',
        appPassword: 'WORDPRESS_APP_PASSWORD',
      },
    },
    {
      id: 'notion',
      outputId: 'article',
      enabled: false,
      envKeys: {
        token:      'NOTION_TOKEN',
        databaseId: 'NOTION_DATABASE_ID',
      },
    },
    {
      id: 'slack',
      outputId: 'article',
      enabled: false,
      envKeys: {
        botToken:  'SLACK_BOT_TOKEN',
        channelId: 'SLACK_CHANNEL_ID',
      },
    },
    {
      id: 'webhook',
      outputId: 'article',
      enabled: false,
      envKeys: {
        url: 'WEBHOOK_URL',
      },
    },
  ],

  // ── Campaigns ─────────────────────────────────────────────────────────────
  // Bulk-invite: upload a CSV of contacts → generate unique interview links
  // → export CSV for email forwarding → track completion per contact.
  campaigns: {
    enabled: false, // flip to true to activate /admin/campaigns + /i/[token]
    tokenTTL: '30d',
    allowAnonymous: true, // keep true so /intake still works without a link
    csvFields: ['name', 'email'], // add columns like 'destination', 'role' as needed
  },
};
