import type {
  ExtractedData,
  IntakeResponse,
  WordPressPayload,
  ImagePlacement,
} from '../types';

export function buildWordPressPayload(
  articleMarkdown: string,
  extracted: ExtractedData,
  intake: IntakeResponse,
  imagePlacements: ImagePlacement[] = [],
  featuredImageUrl: string | null = null
): WordPressPayload {
  const htmlContent = markdownToHtml(articleMarkdown, imagePlacements);

  // Extraction shape varies by config, so every field here is treated as
  // optional — a missing topic must degrade to a usable slug, not a crash.
  const topic = extracted.destination ?? '';
  const cities = extracted.cities ?? [];
  const kebab = (s: string) => s.toLowerCase().replace(/\s+/g, '-');

  const slugParts = [kebab(topic), cities[0] ? kebab(cities[0]) : '', 'travel-guide'].filter(
    Boolean
  );
  const slug = slugParts.join('-').replace(/[^a-z0-9-]/g, '') || 'interview';

  const titleMatch = articleMarkdown.match(/^#\s+(.+)$/m);
  const title = titleMatch
    ? titleMatch[1]
    : topic
      ? `${topic}: A First-Person Travel Guide`
      : 'A First-Person Account';

  const firstParagraph = articleMarkdown
    .split('\n')
    .find((line) => line.trim() && !line.startsWith('#'));
  const excerpt = firstParagraph
    ? firstParagraph.slice(0, 300).trim() + (firstParagraph.length > 300 ? '...' : '')
    : '';

  const categories = ['Travel', topic].filter(Boolean);
  const tags = [
    topic,
    ...cities,
    extracted.purpose || intake.trip_purpose,
    ...(extracted.foodMentions?.length > 0 ? ['Food'] : []),
    ...(extracted.budgetBreakdown?.total ? ['Budget Travel'] : []),
  ].filter(Boolean);

  return {
    title,
    slug,
    content: htmlContent,
    excerpt,
    status: 'draft',
    author_name: extracted.authorName || intake.employee_name,
    categories,
    tags,
    featured_image_url: featuredImageUrl,
    image_placements: imagePlacements,
    meta: {
      destination_country: intake.destination_country,
      destination_cities: intake.destination_cities,
      trip_duration: extracted.tripDuration || intake.trip_type,
      travel_month: extracted.travelMonth || '',
      budget_total: extracted.budgetBreakdown?.total || '',
    },
  };
}

function markdownToHtml(md: string, placements: ImagePlacement[] = []): string {
  // Build a paragraph-indexed map of images to inject
  const placementMap = new Map<number, ImagePlacement>();
  for (const p of placements) {
    placementMap.set(p.insertAfterParagraph, p);
  }

  // Split into blocks and convert
  const blocks = md.split(/\n\n+/);
  let paragraphIndex = 0;
  const htmlBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    let html: string;

    if (/^### /.test(trimmed)) {
      html = trimmed.replace(/^### (.+)$/m, '<h3>$1</h3>');
    } else if (/^## /.test(trimmed)) {
      html = trimmed.replace(/^## (.+)$/m, '<h2>$1</h2>');
    } else if (/^# /.test(trimmed)) {
      html = trimmed.replace(/^# (.+)$/m, '<h1>$1</h1>');
    } else if (/^- /.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .filter((l) => l.startsWith('- '))
        .map((l) => `<li>${inlineFormat(l.slice(2))}</li>`)
        .join('');
      html = `<ul>${items}</ul>`;
    } else {
      paragraphIndex++;
      html = `<p>${inlineFormat(trimmed.replace(/\n/g, ' '))}</p>`;

      // Inject image after this paragraph if one is mapped here
      const img = placementMap.get(paragraphIndex);
      if (img) {
        const caption = img.caption
          ? `<figcaption>${img.caption}</figcaption>`
          : '';
        html += `\n<figure class="article-image"><img src="${img.url}" alt="${img.caption ?? ''}" loading="lazy" />${caption}</figure>`;
      }
    }

    htmlBlocks.push(html);
  }

  return htmlBlocks.join('\n\n');
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
