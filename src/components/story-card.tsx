import type { StoryPreview } from '@/lib/types';

interface StoryCardProps {
  story: StoryPreview;
  compact?: boolean;
}

function formatMonth(travelMonth: string): string {
  if (!travelMonth) return '';
  return travelMonth;
}

export function StoryCard({ story, compact = false }: StoryCardProps) {
  const initials = story.author_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <a
      href={`/articles/${story.slug}`}
      className="group block overflow-hidden transition-all duration-200"
      style={{
        background: '#1e1e2a',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 0,
      }}
    >
      {/* Image */}
      <div className={`relative overflow-hidden ${compact ? 'h-36' : 'h-44'}`}>
        {story.featured_image_url ? (
          <img
            src={story.featured_image_url}
            alt={story.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(107,42,234,0.25) 0%, #1e1e2a 100%)' }}>
            <span style={{ color: '#70707d', fontSize: 32 }}>✦</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(11,15,26,0.5) 0%, transparent 60%)' }} />
        <span className="absolute top-3 left-3 text-white text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
          style={{ background: '#6B2AEA' }}>
          Employee Story
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="text-[11px] uppercase tracking-wider mb-1.5" style={{ color: '#c3c3cc', fontWeight: 400, letterSpacing: '0.06em' }}>
          {story.destination_country}
          {story.travel_month && ` · ${formatMonth(story.travel_month)}`}
        </div>
        <h3 className="text-sm leading-snug line-clamp-2 mb-2 transition-colors"
          style={{ color: '#ededf3', fontWeight: 400 }}>
          {story.title}
        </h3>
        {!compact && (
          <p className="line-clamp-2 leading-relaxed mb-3" style={{ color: '#c3c3cc', fontSize: 13 }}>
            {story.excerpt}
          </p>
        )}

        {/* Author row */}
        <div className="flex items-center gap-2" style={{ borderTop: compact ? '1px solid rgba(255,255,255,0.06)' : undefined, paddingTop: compact ? '0.75rem' : undefined }}>
          {story.author_photo_url ? (
            <img
              src={story.author_photo_url}
              alt={story.author_name}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
              style={{ background: '#272735', border: '1px solid rgba(107,42,234,0.3)', color: '#A78BFA' }}>
              {initials}
            </div>
          )}
          <span className="text-xs truncate" style={{ color: '#70707d' }}>
            {story.author_name}
            {story.author_role && ` · ${story.author_role}`}
          </span>
        </div>
      </div>
    </a>
  );
}
