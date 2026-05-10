import { getOpenAI } from '../openai-client';
import type { TripImage, ImagePlacement, ImageCurationResult } from '../types';

interface CurationResponse {
  coverIndex: number | null;
  placements: Array<{
    imageIndex: number;
    afterParagraph: number;
    caption: string;
  }>;
}

export async function curateImages(
  images: TripImage[],
  articleMarkdown: string,
  destination: string
): Promise<ImageCurationResult> {
  if (!images || images.length === 0) {
    return { featuredImageUrl: null, placements: [] };
  }

  const openai = getOpenAI();

  // Count paragraphs in the article for placement bounds
  const paragraphs = articleMarkdown.split(/\n\n+/).filter(
    (b) => b.trim() && !b.trim().startsWith('#') && !b.trim().startsWith('-')
  );
  const totalParagraphs = paragraphs.length;

  // Build image message content: text description + URL for each image
  const imageContent: Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }> = [
    {
      type: 'text',
      text: `You are helping curate photos for a first-person travel article about ${destination}.

The article has ${totalParagraphs} paragraphs (numbered 1 to ${totalParagraphs}).

Here are ${images.length} trip photos with their descriptions:
${images.map((img, i) => `Photo ${i}: "${img.description}"${img.day ? ` (Day ${img.day})` : ''}`).join('\n')}

Tasks:
1. Select the single BEST cover photo (most scenic, representative, visually striking). Return its index as "coverIndex". If none are suitable, return null.
2. For each remaining photo, decide the best paragraph number (1–${totalParagraphs}) to place it after, based on context relevance. Try to spread images evenly — don't cluster. Write a short, specific caption (max 15 words) referencing what's shown and where.

Return ONLY valid JSON in this exact shape:
{
  "coverIndex": <number or null>,
  "placements": [
    { "imageIndex": <number>, "afterParagraph": <number 1–${totalParagraphs}>, "caption": "<string>" }
  ]
}`,
    },
  ];

  // Add image URLs for vision
  for (const img of images) {
    imageContent.push({
      type: 'image_url',
      image_url: { url: img.url },
    });
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: imageContent as any,
      },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content ?? '{}';
  let parsed: CurationResponse;

  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error('[ImageCurator] Failed to parse response:', raw);
    return { featuredImageUrl: null, placements: [] };
  }

  const featuredImageUrl =
    parsed.coverIndex != null && images[parsed.coverIndex]
      ? images[parsed.coverIndex].url
      : null;

  const coverIndex = parsed.coverIndex ?? -1;

  const placements: ImagePlacement[] = (parsed.placements ?? [])
    .filter((p) => p.imageIndex !== coverIndex && images[p.imageIndex])
    .map((p) => ({
      url: images[p.imageIndex].url,
      insertAfterParagraph: Math.max(1, Math.min(p.afterParagraph, totalParagraphs)),
      caption: p.caption || undefined,
    }));

  return { featuredImageUrl, placements };
}
