'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { StoryPreview } from '@/lib/types';
import { StoryCard } from '@/components/story-card';

// Dynamically import the globe (WebGL — no SSR)
const Globe = dynamic(() => import('@/components/globe'), { ssr: false });

export default function StoriesPage() {
  const [stories, setStories] = useState<StoryPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedStories, setSelectedStories] = useState<StoryPreview[]>([]);

  useEffect(() => {
    fetch('/api/stories')
      .then((r) => r.json())
      .then((data) => setStories(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCountrySelect = (country: string, countryStories: StoryPreview[]) => {
    setSelectedCountry(country);
    setSelectedStories(countryStories);
  };

  const clearSelection = () => {
    setSelectedCountry(null);
    setSelectedStories([]);
  };

  const countryCounts = new Map<string, number>();
  for (const s of stories) {
    countryCounts.set(s.destination_country, (countryCounts.get(s.destination_country) ?? 0) + 1);
  }
  const uniqueCountries = countryCounts.size;
  const uniqueCities = new Set(stories.flatMap((s) => s.destination_cities)).size;

  return (
    <div className="min-h-screen" style={{ background: '#0B0F1A', color: '#ededf3' }}>

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md h-16 flex items-center justify-between px-6 md:px-12"
        style={{ background: 'rgba(11,15,26,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
            style={{ background: '#6B2AEA' }}>H</div>
          <div>
            <div className="text-sm font-semibold leading-tight" style={{ color: '#ededf3' }}>[Company]</div>
            <div className="text-[10px] font-semibold uppercase tracking-wide leading-tight" style={{ color: '#A78BFA' }}>Employee Stories</div>
          </div>
        </a>
        <div className="hidden md:flex items-center gap-6 text-sm">
          <span style={{ color: '#c3c3cc' }}>All destinations</span>
          <a
            href="/intake"
            className="text-white px-5 py-2 rounded-full font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#6B2AEA', fontSize: 14 }}
          >
            Share your story
          </a>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-16 pb-0">
        <div className="px-6 md:px-16 pt-14 pb-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#6B2AEA' }}>
            ✦ Employee Stories
          </p>
          <h1 className="leading-[1.1] max-w-2xl" style={{ fontSize: 'clamp(36px, 5vw, 65px)', fontWeight: 300, color: '#ededf3', letterSpacing: '-0.01em' }}>
            The world, through{' '}
            <span style={{ color: '#ededf3' }}>company eyes</span>
          </h1>
          <p className="mt-5 max-w-xl leading-relaxed" style={{ color: '#c3c3cc', fontSize: 18, fontWeight: 400 }}>
            Our team doesn&apos;t just sell experiences — we live them. Real trips, honest takes, first-person stories from the people building the future of travel.
          </p>

          {/* Stats */}
          {!loading && stories.length > 0 && (
            <div className="flex gap-12 mt-10">
              {[
                { value: stories.length, label: 'Stories' },
                { value: uniqueCountries, label: 'Countries' },
                { value: uniqueCities, label: 'Cities' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div style={{ fontSize: 42, fontWeight: 300, color: '#ededf3', lineHeight: 1.1 }}>{value}</div>
                  <div className="mt-1 text-xs uppercase tracking-widest" style={{ color: '#70707d' }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Globe + Sidebar */}
        <div className="flex flex-col md:flex-row md:h-[560px]">
          {/* Globe */}
          <div className="flex-1 relative min-h-[360px] md:min-h-0">
            {!loading && (
              <Globe
                stories={stories}
                onCountrySelect={handleCountrySelect}
                selectedCountry={selectedCountry}
              />
            )}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-sm" style={{ color: '#70707d' }}>Loading stories…</div>
              </div>
            )}

            {/* Hint */}
            {!loading && stories.length > 0 && !selectedCountry && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 backdrop-blur-sm text-xs px-4 py-2 rounded-full pointer-events-none"
                style={{ background: 'rgba(30,30,42,0.85)', color: '#c3c3cc', border: '1px solid rgba(255,255,255,0.08)' }}>
                Click a highlighted country to explore stories
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full md:w-80 flex flex-col"
            style={{ background: '#1e1e2a', borderTop: '1px solid rgba(255,255,255,0.06)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            {selectedCountry ? (
              <>
                <div className="p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B2AEA' }}>
                        {selectedStories.length} {selectedStories.length === 1 ? 'story' : 'stories'}
                      </p>
                      <h2 className="text-lg mt-0.5" style={{ color: '#ededf3', fontWeight: 400 }}>{selectedCountry}</h2>
                      <p className="text-xs mt-1" style={{ color: '#70707d' }}>
                        {[...new Set(selectedStories.flatMap((s) => s.destination_cities))].join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={clearSelection}
                      className="text-xl leading-none mt-1 transition-colors hover:opacity-70"
                      style={{ color: '#70707d' }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-px">
                  {selectedStories.map((story) => (
                    <StoryCard key={story.sessionId} story={story} compact />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 text-3xl font-light" style={{ color: '#272735' }}>✦</div>
                <p className="text-sm leading-relaxed" style={{ color: '#70707d' }}>
                  {loading
                    ? 'Loading…'
                    : stories.length === 0
                    ? 'No stories yet. Be the first to share yours.'
                    : `${uniqueCountries} countries explored. Click a highlighted country on the globe to read the stories.`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* All stories grid */}
      <div className="px-6 md:px-16 py-16">
        <div className="flex items-center justify-between mb-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1.5rem' }}>
          <h2 style={{ fontSize: 32, fontWeight: 300, color: '#ededf3', letterSpacing: '-0.01em' }}>
            {selectedCountry ? `Stories from ${selectedCountry}` : 'All stories'}
          </h2>
          {selectedCountry && (
            <button onClick={clearSelection} className="text-sm transition-opacity hover:opacity-70"
              style={{ color: '#c3c3cc' }}>
              View all →
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse" style={{ background: '#1e1e2a' }} />
            ))}
          </div>
        ) : stories.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg mb-6" style={{ color: '#70707d' }}>No stories published yet.</p>
            <a
              href="/intake"
              className="inline-block text-white px-8 py-4 rounded-full font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#6B2AEA' }}
            >
              Be the first to share your story
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {(selectedCountry
              ? stories.filter((s) => s.destination_country === selectedCountry)
              : stories
            ).map((story) => (
              <StoryCard key={story.sessionId} story={story} />
            ))}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet — slides up when a country is selected */}
      {selectedCountry && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={clearSelection}
        >
          <div
            className="absolute bottom-0 left-0 right-0 flex flex-col"
            style={{
              background: '#1e1e2a',
              borderTop: '2px solid #6B2AEA',
              borderRadius: '16px 16px 0 0',
              maxHeight: '72vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
            </div>
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B2AEA' }}>
                  {selectedStories.length} {selectedStories.length === 1 ? 'story' : 'stories'}
                </p>
                <h2 className="text-lg mt-0.5" style={{ color: '#ededf3', fontWeight: 400 }}>{selectedCountry}</h2>
                <p className="text-xs mt-0.5" style={{ color: '#70707d' }}>
                  {[...new Set(selectedStories.flatMap((s) => s.destination_cities))].join(', ')}
                </p>
              </div>
              <button onClick={clearSelection} className="text-2xl leading-none mt-1" style={{ color: '#70707d' }}>×</button>
            </div>
            {/* Cards */}
            <div className="overflow-y-auto flex-1 p-4 space-y-px">
              {selectedStories.map((story) => (
                <StoryCard key={story.sessionId} story={story} compact />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 md:px-16 py-8 flex items-center justify-between text-xs"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#70707d' }}>
        <span>© Employee Stories</span>
      </div>
    </div>
  );
}
