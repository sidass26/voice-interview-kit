'use client';

import { useEffect, useState } from 'react';

declare global {
  interface Window {
    __applyDarkVars?: () => void;
    __clearDarkVars?: () => void;
  }
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !dark;
    const el = document.documentElement;
    if (next) {
      el.classList.add('dark');
      el.classList.remove('light');
      window.__applyDarkVars?.();
    } else {
      el.classList.remove('dark');
      el.classList.add('light');
      window.__clearDarkVars?.();
    }
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setDark(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light/dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        color: 'var(--muted-foreground)',
        fontSize: 16,
        lineHeight: 1,
        padding: '5px 8px',
        borderRadius: 6,
        background: 'none',
        border: '1px solid var(--border)',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}
