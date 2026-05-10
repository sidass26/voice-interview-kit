import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Travel Interview",
  description: "Internal tool for capturing authentic travel content through voice interviews",
};

// Dark mode CSS vars — injected as inline JS so they apply before first paint
// (Next.js App Router strips <style dangerouslySetInnerHTML> from <head>)
const DARK_VARS = `--background:#0B0F1A;--foreground:#ededf3;--card:#1e1e2a;--card-foreground:#ededf3;--muted:#272735;--muted-foreground:#c3c3cc;--border:rgba(255,255,255,0.08);--input:#1e1e2a;--primary:#6B2AEA;--primary-foreground:#ffffff;--secondary:#272735;--secondary-foreground:#ededf3;--ring:rgba(107,42,234,0.4);--destructive:#ef4444;--destructive-foreground:#ffffff;--accent:#272735;--accent-foreground:#ededf3;--popover:#1e1e2a;--popover-foreground:#ededf3`;

const LIGHT_VARS = `--background:#f8f8fc;--foreground:#111118;--card:#ffffff;--card-foreground:#111118;--muted:#f0f0f6;--muted-foreground:#70707d;--border:rgba(0,0,0,0.08);--input:#ffffff;--primary:#6B2AEA;--primary-foreground:#ffffff;--secondary:#f0f0f6;--secondary-foreground:#111118;--ring:rgba(107,42,234,0.3);--destructive:#ef4444;--destructive-foreground:#ffffff;--accent:#f0f0f6;--accent-foreground:#111118;--popover:#ffffff;--popover-foreground:#111118`;

const antiFlashScript = `(function(){
  var DARK='${DARK_VARS}';
  var styleId='__theme-vars';
  function buildCss(vars){return ':root{'+vars.split(';').join(';')+'}'}
  function applyVars(vars){
    var el=document.getElementById(styleId);
    if(!el){el=document.createElement('style');el.id=styleId;document.head.appendChild(el);}
    el.textContent=buildCss(vars);
  }
  function clearVars(){
    var el=document.getElementById(styleId);
    if(el)el.textContent='';
  }
  try{
    var t=localStorage.getItem('theme');
    var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
    if(dark){document.documentElement.classList.add('dark');applyVars(DARK);}
    else{document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');}
  }catch(e){}
  window.__applyDarkVars=function(){applyVars(DARK);};
  window.__clearDarkVars=function(){clearVars();};
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFlashScript }} />
      </head>
      <body className="min-h-full flex flex-col" style={{ background: 'var(--background)' }}>
        <nav
          className="px-6 py-3"
          style={{
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <a href="/" className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
              Travel Interview
            </a>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Internal Tool</span>
              <ThemeToggle />
            </div>
          </div>
        </nav>
        <main className="flex-1 px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
