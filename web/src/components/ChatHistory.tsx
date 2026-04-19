import { useEffect, useState } from 'react';
import { useStore } from '../hooks/useStore';
import type { Message, Session } from '../lib/types';

function relativeTime(ts: number, now: number): string {
  const delta = Math.max(0, now - ts);
  const s = Math.floor(delta / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function firstUserMessage(msgs: Message[]): string | null {
  const u = msgs.find((m) => m.kind === 'user');
  if (u && u.kind === 'user') return u.text;
  return null;
}

export function ChatHistory() {
  const { store, session, newSession, switchSession, deleteSession } = useStore();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const sorted = [...store.sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  const handleDelete = (e: React.MouseEvent, s: Session) => {
    e.stopPropagation();
    const hasContent = s.messages.length > 0 || s.filters.length > 0;
    if (hasContent && !confirm(`delete "${s.icp.name}"? this removes the chat + iterations.`)) return;
    deleteSession(s.id);
  };

  return (
    <div
      className="flex flex-col h-full min-h-0"
      style={{
        background: 'rgba(7,7,26,0.55)',
        borderRight: '0.5px solid var(--glass-border)',
        backdropFilter: 'blur(14px)',
      }}
    >
      {/* Top — wordmark + new */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-baseline justify-between mb-3">
          <span className="smallcaps">plates</span>
          <span className="coord">{store.sessions.length.toString().padStart(2, '0')}</span>
        </div>
        <button
          onClick={() => newSession()}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 transition-all duration-150 rise"
          style={{
            background:
              'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(99,102,241,0.14))',
            border: '0.5px solid rgba(167,139,250,0.35)',
            borderRadius: 4,
            color: '#c4b5fd',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(99,102,241,0.24))';
            e.currentTarget.style.borderColor = 'rgba(167,139,250,0.6)';
            e.currentTarget.style.boxShadow = '0 0 18px rgba(124,58,237,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(99,102,241,0.14))';
            e.currentTarget.style.borderColor = 'rgba(167,139,250,0.35)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: 'linear-gradient(135deg,#a78bfa,#6366f1)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            +
          </span>
          <span>new plate</span>
          <span className="ml-auto coord" style={{ color: 'rgba(167,139,250,0.5)' }}>
            ⌘N
          </span>
        </button>
      </div>

      {/* Divider */}
      <div
        className="mx-4 h-px"
        style={{
          background:
            'linear-gradient(to right, transparent, rgba(167,139,250,0.18), transparent)',
        }}
      />

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-thin py-2 min-h-0">
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-center coord">no plates yet</p>
        ) : (
          <ul>
            {sorted.map((s, i) => {
              const active = s.id === store.activeId;
              const preview = firstUserMessage(s.messages);
              const msgCount = s.messages.filter(
                (m) => m.kind === 'user' || m.kind === 'assistant'
              ).length;
              const lastP = s.history.filter((h) => h.p_at_10 != null).slice(-1)[0]?.p_at_10;
              return (
                <li
                  key={s.id}
                  className="group relative mx-2 rise"
                  style={{ animationDelay: `${i * 20}ms` }}
                >
                  <button
                    className="w-full text-left px-3 py-2.5 transition-colors"
                    style={{
                      background: active
                        ? 'linear-gradient(to right, rgba(124,58,237,0.18), rgba(124,58,237,0.06))'
                        : 'transparent',
                      borderLeft: active
                        ? '2px solid rgba(167,139,250,0.8)'
                        : '2px solid transparent',
                      borderRadius: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                    }}
                    onMouseLeave={(e) => {
                      if (!active) e.currentTarget.style.background = 'transparent';
                    }}
                    onClick={() => switchSession(s.id)}
                  >
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <span
                        className="mono text-[12px] truncate flex-1"
                        style={{
                          color: active ? '#c4b5fd' : 'var(--color-ink-2)',
                          fontWeight: active ? 600 : 400,
                          letterSpacing: '0.02em',
                        }}
                      >
                        {s.icp.name || 'UNTITLED-PLATE'}
                      </span>
                      <span className="coord shrink-0" style={{ fontSize: 10 }}>
                        {relativeTime(s.updatedAt, now)}
                      </span>
                    </div>
                    {preview ? (
                      <div
                        className="text-[12px] leading-snug line-clamp-2 pr-6"
                        style={{
                          color: active ? 'var(--color-ink-2)' : 'var(--color-faded)',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          opacity: 0.85,
                        }}
                      >
                        {preview}
                      </div>
                    ) : (
                      <div className="text-[12px] italic" style={{ color: 'var(--color-faint)' }}>
                        empty plate
                      </div>
                    )}
                    <div
                      className="mt-1 flex items-center gap-2 coord"
                      style={{ fontSize: 10 }}
                    >
                      <span>i{s.iteration.toString().padStart(2, '0')}</span>
                      <span>·</span>
                      <span>{msgCount.toString().padStart(2, '0')} msg</span>
                      {lastP != null && (
                        <>
                          <span>·</span>
                          <span
                            style={{
                              color:
                                lastP >= 0.7
                                  ? 'var(--grad-positive-a)'
                                  : 'var(--color-faded)',
                            }}
                          >
                            p@10 {Math.round(lastP * 100)}%
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                  <button
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5"
                    style={{
                      color: '#f87171',
                      fontSize: 12,
                      lineHeight: 1,
                    }}
                    title="delete plate"
                    onClick={(e) => handleDelete(e, s)}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-2.5 coord"
        style={{
          borderTop: '0.5px solid var(--glass-border)',
          background: 'rgba(7,7,26,0.4)',
          fontSize: 10,
        }}
      >
        <span style={{ color: 'rgba(167,139,250,0.4)' }}>■</span>
        <span className="ml-2">session · active</span>
        <span className="ml-auto float-right" style={{ color: 'var(--color-faint)' }}>
          v2 · local
        </span>
      </div>
    </div>
  );
}
