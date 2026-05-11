/**
 * Config singleton loader.
 *
 * All engine files import from here — never from the root interview.config.ts
 * directly. This keeps the import hierarchy clean:
 *
 *   interview.config.ts  →  src/lib/prompts/*   (leaf imports)
 *   src/lib/config/index.ts  ←  all engine files  (reads config)
 *
 * No circular dependencies are possible as long as src/lib/prompts/* never
 * imports from src/lib/config/*.
 */

import { config } from '../../../interview.config';
import type { InterviewConfig } from './types';

// Runtime guard — catches empty outputs[] that the type system no longer
// enforces (changed from tuple to plain array for ergonomics).
if (!config.outputs || config.outputs.length === 0) {
  throw new Error(
    '[voice-interview-kit] interview.config.ts must define at least one entry in `outputs`.'
  );
}

export function getConfig(): InterviewConfig {
  return config;
}
