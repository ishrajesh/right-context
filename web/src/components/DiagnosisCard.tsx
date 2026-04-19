import { useCallback, useState } from 'react';
import { useStore } from '../hooks/useStore';
import { runAgentTurn } from '../lib/agent';
import type { Message } from '../lib/types';

const uid = () => Math.random().toString(36).slice(2, 10);

export function DiagnosisCard() {
  const { session, update, updateSession, getStore } = useStore();
  const { diagnosis, history, iteration } = session;
  const [busy, setBusy] = useState(false);

  const respond = useCallback(
    async (text: string) => {
      if (busy) return;
      setBusy(true);
      const msg: Message = { id: uid(), kind: 'user', text, ts: Date.now() };
      updateSession((s) => ({
        ...s,
        messages: [...s.messages, msg],
        diagnosis: s.diagnosis ? { ...s.diagnosis, accepted: text.startsWith('accept') } : null,
      }));

      await runAgentTurn({
        store: getStore(),
        update,
        getStore,
        userText: text,
        onAssistantText: (t) => {
          updateSession((s) => ({
            ...s,
            messages: [...s.messages, { id: uid(), kind: 'assistant', text: t, ts: Date.now() }],
          }));
        },
        onToolCall: (tool) => {
          const surfaced = new Set(['enrich_company']);
          if (!surfaced.has(tool.name)) return;
          updateSession((s) => ({
            ...s,
            messages: [
              ...s.messages,
              { id: uid(), kind: 'tool', name: tool.name, input: tool.input, result: tool.result, ts: Date.now() },
            ],
          }));
        },
        onError: () => {},
      });

      setBusy(false);
    },
    [busy, update, updateSession, getStore]
  );

  if (!diagnosis) return null;

  const pct = Math.round(diagnosis.p_at_10 * 100);
  const sparkPoints = history
    .filter((h) => h.p_at_10 != null)
    .slice(-10)
    .map((h) => h.p_at_10 as number);

  const countEntries = Object.entries(diagnosis.counts).sort(
    (a, b) => (b[1] as number) - (a[1] as number)
  );
  const maxCount = Math.max(1, ...countEntries.map(([, v]) => v as number));

  const decided = diagnosis.accepted != null;
  const pctColor = pct >= 70 ? '#34d399' : pct >= 50 ? '#a78bfa' : '#f87171';

  return (
    <div className="rise flex gap-3">
      <div className="coord shrink-0 pt-1 select-none" style={{ color: 'rgba(167,139,250,0.4)' }}>△</div>
      <div className="flex-1 max-w-[620px]">
        {/* Header */}
        <div
          className="flex items-center justify-between mb-4 pb-3"
          style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <span className="smallcaps">diagnosis · iteration {iteration.toString().padStart(2, '0')}</span>
          <span className="display text-[22px] font-bold" style={{ color: pctColor }}>
            {pct}%
          </span>
        </div>

        {sparkPoints.length > 1 && (
          <div className="mb-5">
            <div className="coord mb-2" style={{ color: 'var(--color-faint)' }}>precision across iterations</div>
            <Sparkline values={sparkPoints} />
          </div>
        )}

        {countEntries.length > 0 && (
          <div className="mb-5">
            <div className="coord mb-2" style={{ color: 'var(--color-faint)' }}>miss categories</div>
            <ul className="space-y-1.5">
              {countEntries.map(([cat, n]) => {
                const isTop = cat === diagnosis.top_category;
                const frac = Number(n) / maxCount;
                return (
                  <li key={cat} className="grid grid-cols-[160px_1fr_auto] gap-2 items-center">
                    <span className="mono text-[11.5px] truncate" style={{ color: isTop ? '#a78bfa' : 'var(--color-faded)' }}>
                      {cat}
                    </span>
                    <div className="h-[6px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}>
                      <div
                        className="h-full"
                        style={{
                          width: `${frac * 100}%`,
                          background: isTop ? 'linear-gradient(to right,#7c3aed,#a78bfa)' : 'rgba(255,255,255,0.15)',
                          borderRadius: '2px',
                          transition: 'width 600ms ease-out',
                        }}
                      />
                    </div>
                    <span className="mono text-[11px]" style={{ color: 'var(--color-faded)' }}>{n}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Proposal box */}
        <div
          className="px-4 py-3 mb-4"
          style={{
            background: 'rgba(124,58,237,0.07)',
            border: '0.5px solid rgba(124,58,237,0.2)',
            borderLeft: '2px solid rgba(124,58,237,0.5)',
          }}
        >
          <div className="coord mb-2" style={{ color: 'rgba(167,139,250,0.6)' }}>proposal · single axis</div>
          <div className="text-[14px] leading-snug" style={{ color: 'var(--color-ink-2)' }}>
            {diagnosis.proposal}
          </div>
        </div>

        {!decided ? (
          <div className="flex gap-2">
            <button className="btn-tick" onClick={() => respond('reject the proposal. leave the filters as-is.')} disabled={busy}>
              reject
            </button>
            <button
              className="btn-tick btn-tick-accent"
              onClick={() => respond('accept the proposal. apply the single-axis change via propose_filters, then run_search and score the new results.')}
              disabled={busy}
            >
              accept & re-run
            </button>
          </div>
        ) : (
          <div className="coord" style={{ color: diagnosis.accepted ? '#34d399' : 'var(--color-faint)' }}>
            {diagnosis.accepted ? '✓ accepted · surveying' : '○ rejected'}
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 240;
  const h = 36;
  const pad = 3;
  const xs = values.map((_, i) => pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1));
  const ys = values.map((v) => h - pad - v * (h - pad * 2));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');

  return (
    <svg width={w} height={h} className="block overflow-visible">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <line
        x1={0} y1={h - pad - 0.7 * (h - pad * 2)}
        x2={w} y2={h - pad - 0.7 * (h - pad * 2)}
        stroke="rgba(255,255,255,0.12)"
        strokeDasharray="3 4"
        strokeWidth={0.5}
      />
      <path d={path} fill="none" stroke="url(#spark-grad)" strokeWidth={1.5} />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 2.5 : 1.5}
          fill={i === xs.length - 1 ? '#a78bfa' : 'rgba(167,139,250,0.5)'} />
      ))}
      {xs.length > 0 && (
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={6} fill="rgba(124,58,237,0.2)" />
      )}
    </svg>
  );
}
