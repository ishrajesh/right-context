import { useEffect, useState } from 'react';
import { useStore } from '../hooks/useStore';
import { StatePanel } from './StatePanel';
import { Chat } from './Chat';
import { ChatHistory } from './ChatHistory';

export function Workspace({ openSettings }: { openSettings: () => void }) {
  const { store, session, newSession } = useStore();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        openSettings();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        newSession();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openSettings, newSession]);

  const pAt10 = session.diagnosis?.p_at_10;

  return (
    <div className="canvas relative min-h-screen flex flex-col noise overflow-hidden">
      {/* Dot grid overlay */}
      <div className="pointer-events-none absolute inset-0 dot-grid opacity-100 z-0" />

      {/* Gutter coordinates */}
      <div className="pointer-events-none absolute left-3 top-0 bottom-0 flex flex-col justify-between py-24 coord opacity-30 z-0">
        {['A1','B2','C3','D4','E5'].map(c => <span key={c}>{c}</span>)}
      </div>
      <div className="pointer-events-none absolute right-3 top-0 bottom-0 flex flex-col justify-between py-24 coord opacity-30 z-0">
        {['01','02','03','04','05'].map(c => <span key={c}>{c}</span>)}
      </div>

      {/* Header */}
      <header className="relative z-10 px-12 pt-7 pb-5">
        <div className="flex items-center justify-between">
          {/* Wordmark */}
          <div className="flex items-center gap-5">
            <div>
              <div className="display text-[38px] font-extrabold tracking-tight leading-none">
                <span className="grad-text">right</span>
                <span className="mx-[6px]" style={{ color: 'rgba(167,139,250,0.5)' }}>·</span>
                <span className="grad-text">context</span>
              </div>
              <div className="coord mt-0.5" style={{ letterSpacing: '0.18em', color: 'rgba(167,139,250,0.35)' }}>
                icp survey instrument
              </div>
            </div>
            <div
              className="w-px self-stretch opacity-20 mx-1"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(167,139,250,0.6), transparent)' }}
            />
            <span className="smallcaps">Field Survey</span>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-5 mono text-[12px]">
            <StatusChip label="plate" value={session.icp.name || 'UNTITLED'} />
            <StatusChip label="iter" value={session.iteration.toString().padStart(2, '0')} />
            <StatusChip
              label="p@10"
              value={pAt10 == null ? '—' : `${Math.round(pAt10 * 100)}%`}
              highlight={pAt10 != null}
            />
            <button className="btn-tick" onClick={openSettings} aria-label="settings">
              settings ⌘,
            </button>
          </div>
        </div>

        {/* Gradient rule */}
        <div className="mt-5 relative h-px draw-rule" style={{
          background: 'linear-gradient(to right, transparent, rgba(124,58,237,0.6) 20%, rgba(99,102,241,0.5) 60%, rgba(56,189,248,0.3) 85%, transparent)',
        }} />

        {/* Coordinate line */}
        <div className="mt-3 flex items-baseline justify-between coord">
          <span>
            lat {48 + (session.iteration % 9)}.{(session.filters.length * 137) % 1000} N
            {' · '}
            lon {122 + (session.results.length % 11)}.{(session.iteration * 211) % 1000} W
          </span>
          <span>
            {now.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
            {' · '}
            {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </header>

      {/* Main layout */}
      <main className="relative z-10 flex-1 grid grid-cols-[240px_360px_minmax(0,1fr)] gap-0 px-12 pb-6 min-h-0">
        <aside className="-ml-4 min-h-0">
          <ChatHistory />
        </aside>
        <aside className="px-6 overflow-y-auto scroll-thin border-r hair" style={{ borderColor: 'rgba(167,139,250,0.12)' }}>
          <StatePanel />
        </aside>
        <section className="pl-8 flex flex-col min-h-0">
          <Chat />
        </section>
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 hair mx-12 mt-auto py-3 flex items-baseline justify-between coord"
        style={{ borderTop: '0.5px solid rgba(167,139,250,0.12)' }}
      >
        <span>
          plate · {session.icp.name || 'untitled'} · {session.filters.length} filters · {session.results.length} companies
        </span>
        <span>autosaved · localStorage v2 · right·context ◈</span>
      </footer>
    </div>
  );
}

function StatusChip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5 px-2.5 py-1 rounded" style={{
      background: 'rgba(255,255,255,0.03)',
      border: '0.5px solid rgba(255,255,255,0.07)',
      fontFamily: 'var(--font-mono)',
      fontSize: '11.5px',
    }}>
      <span style={{ color: 'rgba(167,139,250,0.4)', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: highlight ? '#a78bfa' : 'rgba(196,196,232,0.85)', fontWeight: highlight ? 500 : 400 }}>{value}</span>
    </span>
  );
}
