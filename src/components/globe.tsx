'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { StoryPreview } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GlobeGL = dynamic(() => import('react-globe.gl'), { ssr: false }) as any;

// Maps our DB destination_country strings (lowercase) to GeoJSON properties.name
const DB_TO_GEOJSON: Record<string, string> = {
  'usa': 'United States of America',
  'united states': 'United States of America',
  'uk': 'United Kingdom',
  'great britain': 'United Kingdom',
  'england': 'United Kingdom',
  'uae': 'United Arab Emirates',
  'south korea': 'South Korea',
  'republic of korea': 'South Korea',
  'north korea': 'North Korea',
  'czech republic': 'Czech Republic',
  'czechia': 'Czech Republic',
  'russia': 'Russia',
  'taiwan': 'Taiwan',
  'iran': 'Iran',
  'syria': 'Syria',
  'tanzania': 'Tanzania',
  'bolivia': 'Bolivia',
  'venezuela': 'Venezuela',
  'vietnam': 'Vietnam',
  'laos': 'Laos',
  'myanmar': 'Myanmar',
};

function toGeoName(country: string): string {
  const lower = country.toLowerCase().trim();
  if (DB_TO_GEOJSON[lower]) return DB_TO_GEOJSON[lower];
  return country.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

interface GeoFeature {
  type: string;
  properties: { name: string };
  geometry: object;
}

interface GlobeProps {
  stories: StoryPreview[];
  onCountrySelect: (country: string, stories: StoryPreview[]) => void;
  selectedCountry: string | null;
}

export default function Globe({ stories, onCountrySelect }: GlobeProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [geoData, setGeoData] = useState<GeoFeature[]>([]);
  const [width, setWidth] = useState(520);
  const autoRotateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
      .then(r => r.json())
      .then(d => setGeoData(d.features ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.round(w));
    });
    ro.observe(el);
    if (el.offsetWidth > 0) setWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  // Enable auto-rotation after globe + data are ready
  useEffect(() => {
    if (!geoData.length) return;
    const t = setTimeout(() => {
      const g = globeRef.current;
      if (!g?.controls) return;
      g.controls().autoRotate = true;
      g.controls().autoRotateSpeed = 0.5;
      g.pointOfView({ altitude: 2.2 });
    }, 600);
    return () => clearTimeout(t);
  }, [geoData]);

  const storiesByCountry = useMemo(() => {
    const map = new Map<string, StoryPreview[]>();
    for (const s of stories) {
      const key = s.destination_country;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [stories]);

  const { visitedGeoNames, geoNameToDbCountry } = useMemo(() => {
    const visited = new Set<string>();
    const lookup = new Map<string, string>();
    for (const dbCountry of storiesByCountry.keys()) {
      const geoName = toGeoName(dbCountry);
      visited.add(geoName);
      lookup.set(geoName, dbCountry);
    }
    return { visitedGeoNames: visited, geoNameToDbCountry: lookup };
  }, [storiesByCountry]);

  const handlePolygonClick = useCallback((polygon: object) => {
    const name = (polygon as GeoFeature).properties.name;
    const dbCountry = geoNameToDbCountry.get(name);
    if (!dbCountry) return;
    const countryStories = storiesByCountry.get(dbCountry);
    if (!countryStories) return;
    onCountrySelect(dbCountry, countryStories);
    const g = globeRef.current;
    if (g?.controls) {
      g.controls().autoRotate = false;
      if (autoRotateTimeoutRef.current) clearTimeout(autoRotateTimeoutRef.current);
      autoRotateTimeoutRef.current = setTimeout(() => {
        if (g.controls) g.controls().autoRotate = true;
      }, 4000);
    }
  }, [geoNameToDbCountry, storiesByCountry, onCountrySelect]);

  const getPolygonCapColor = useCallback((polygon: object) => {
    const name = (polygon as GeoFeature).properties.name;
    return visitedGeoNames.has(name) ? '#6B2AEA' : '#1e1e2a';
  }, [visitedGeoNames]);

  const getPolygonAltitude = useCallback((polygon: object) => {
    const name = (polygon as GeoFeature).properties.name;
    return visitedGeoNames.has(name) ? 0.014 : 0.006;
  }, [visitedGeoNames]);

  const getPolygonLabel = useCallback((polygon: object) => {
    const name = (polygon as GeoFeature).properties.name;
    if (!visitedGeoNames.has(name)) return '';
    const dbCountry = geoNameToDbCountry.get(name) ?? name;
    const count = storiesByCountry.get(dbCountry)?.length ?? 0;
    return `<div style="background:rgba(11,15,26,0.92);color:#ededf3;padding:6px 12px;border-radius:6px;font-size:13px;font-family:system-ui,sans-serif;border:1px solid rgba(107,42,234,0.5);pointer-events:none">
      <strong style="display:block">${name}</strong>
      <span style="color:#A78BFA;font-size:11px">${count} ${count === 1 ? 'story' : 'stories'}</span>
    </div>`;
  }, [visitedGeoNames, geoNameToDbCountry, storiesByCountry]);

  const handlePolygonHover = useCallback((polygon: object | null) => {
    if (!containerRef.current) return;
    const name = polygon ? (polygon as GeoFeature).properties.name : null;
    const isVisited = name ? visitedGeoNames.has(name) : false;
    containerRef.current.style.cursor = isVisited ? 'pointer' : 'grab';
  }, [visitedGeoNames]);

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
      {geoData.length > 0 && (
        <GlobeGL
          ref={globeRef}
          width={width}
          height={width}
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor="#6B2AEA"
          atmosphereAltitude={0.18}
          polygonsData={geoData}
          polygonCapColor={getPolygonCapColor}
          polygonSideColor={() => 'rgba(107,42,234,0.07)'}
          polygonStrokeColor={() => 'rgba(255,255,255,0.04)'}
          polygonAltitude={getPolygonAltitude}
          polygonLabel={getPolygonLabel}
          onPolygonClick={handlePolygonClick}
          onPolygonHover={handlePolygonHover}
        />
      )}
    </div>
  );
}
