'use client';

import { useEffect, useRef, useCallback } from 'react';
import createGlobe from 'cobe';

export interface PolaroidMarker {
  id: string;
  location: [number, number]; // [lat, lng]
  image: string;
  caption: string;
  rotate: number;
}

interface GlobePolaroidsProps {
  markers?: PolaroidMarker[];
  className?: string;
  speed?: number;
  onMarkerClick?: (id: string) => void;
}

export function GlobePolaroids({
  markers = [],
  className = '',
  speed = 0.004,
  onMarkerClick,
}: GlobePolaroidsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const polaroidRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const phiAccRef = useRef(0);       // accumulated base phi (always growing)
  const phiOffsetRef = useRef(0);    // user drag offset (committed on release)
  const thetaOffsetRef = useRef(0);  // user drag theta offset
  const currentPhiRef = useRef(0);   // current rendered phi
  const currentThetaRef = useRef(0.2);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        };
      }
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [handlePointerUp]);

  // Click → find nearest visible marker within 50px
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !onMarkerClick) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const width = rect.width;

    const phi = currentPhiRef.current;
    const theta = currentThetaRef.current;
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    let closest: string | null = null;
    let closestDist = 50;

    for (const m of markers) {
      const [lat, lng] = m.location;
      const lambda = (lng * Math.PI) / 180;
      const phiLat = (lat * Math.PI) / 180;
      const x = Math.cos(phiLat) * Math.sin(lambda - phi);
      const y = Math.sin(phiLat) * cosTheta - Math.cos(phiLat) * Math.cos(lambda - phi) * sinTheta;
      const z = Math.sin(phiLat) * sinTheta + Math.cos(phiLat) * Math.cos(lambda - phi) * cosTheta;
      if (z < 0.05) continue;
      const sx = (x + 1) * (width / 2);
      const sy = (1 - y) * (width / 2);
      const dist = Math.sqrt((sx - cx) ** 2 + (sy - cy) ** 2);
      if (dist < closestDist) { closestDist = dist; closest = m.id; }
    }
    if (closest) onMarkerClick(closest);
  }, [markers, onMarkerClick]);

  // Project marker positions and update polaroid divs directly (no React state per frame)
  const updatePolaroids = useCallback((phi: number, theta: number, width: number) => {
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    for (const m of markers) {
      const el = polaroidRefs.current.get(m.id);
      if (!el) continue;

      const [lat, lng] = m.location;
      const lambda = (lng * Math.PI) / 180;
      const phiLat = (lat * Math.PI) / 180;

      const x = Math.cos(phiLat) * Math.sin(lambda - phi);
      const y = Math.sin(phiLat) * cosTheta - Math.cos(phiLat) * Math.cos(lambda - phi) * sinTheta;
      const z = Math.sin(phiLat) * sinTheta + Math.cos(phiLat) * Math.cos(lambda - phi) * cosTheta;

      const opacity = z < 0.05 ? 0 : Math.min(1, (z - 0.05) * 5);
      const sx = (x + 1) * (width / 2);
      const sy = (1 - y) * (width / 2);

      el.style.left = `${sx}px`;
      el.style.bottom = `${width - sy}px`;
      el.style.opacity = String(opacity);
      el.style.pointerEvents = opacity > 0.1 ? 'auto' : 'none';
    }
  }, [markers]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let globe: ReturnType<typeof createGlobe> | null = null;
    let animationId: number;

    function init() {
      const width = canvas.offsetWidth;
      if (width === 0 || globe) return;

      globe = createGlobe(canvas, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height: width,
        phi: 0,
        theta: 0.2,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.12, 0.08, 0.2],
        markerColor: [0.42, 0.16, 0.92],
        glowColor: [0.25, 0.1, 0.55],
        markers: markers.map((m) => ({ location: m.location, size: 0.04 })),
      });

      function animate() {
        animationId = requestAnimationFrame(animate);

        // Always increment phi (continuous rotation)
        phiAccRef.current += speed;

        const phi = phiAccRef.current + phiOffsetRef.current + dragOffset.current.phi;
        const theta = 0.2 + thetaOffsetRef.current + dragOffset.current.theta;

        currentPhiRef.current = phi;
        currentThetaRef.current = theta;

        globe!.update({ phi, theta });
        updatePolaroids(phi, theta, width);
      }

      animate();
      setTimeout(() => canvas && (canvas.style.opacity = '1'));
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) { ro.disconnect(); init(); }
      });
      ro.observe(canvas);
      return () => {
        ro.disconnect();
        cancelAnimationFrame(animationId);
        if (globe) globe.destroy();
      };
    }

    return () => {
      cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, speed, updatePolaroids]);

  return (
    <div className={`relative select-none ${className}`} style={{ aspectRatio: '1' }}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onClick={handleCanvasClick}
        style={{
          width: '100%', height: '100%', cursor: 'grab', opacity: 0,
          transition: 'opacity 1.2s ease', borderRadius: '50%', touchAction: 'none',
        }}
      />
      {markers.map((m) => (
        <div
          key={m.id}
          ref={(el) => {
            if (el) polaroidRefs.current.set(m.id, el);
            else polaroidRefs.current.delete(m.id);
          }}
          style={{
            position: 'absolute',
            transform: `rotate(${m.rotate}deg) translateX(-50%)`,
            transformOrigin: 'bottom center',
            background: '#fff',
            padding: '5px 5px 20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.3s',
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {m.image ? (
            <img
              src={m.image}
              alt={m.caption}
              style={{ display: 'block', width: 56, height: 56, objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, rgba(107,42,234,0.3), #1e1e2a)' }} />
          )}
          <span style={{
            position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center',
            fontFamily: 'system-ui, sans-serif', fontSize: '0.45rem', color: '#333',
            letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', padding: '0 3px',
          }}>{m.caption}</span>
        </div>
      ))}
    </div>
  );
}
