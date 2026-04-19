import { useStore } from '../hooks/useStore';

export function PreflightCard() {
  const { session } = useStore();
  const pf = session.preflight;
  if (!pf) return null;

  const hits = pf.rows.filter((r) => r.matched).length;
  const pct = Math.round(pf.hitRate * 100);
  const ok = pf.hitRate >= 0.7;

  return (
    <div className="rise flex gap-3">
      <div className="coord shrink-0 pt-1 select-none" style={{ color: 'rgba(167,139,250,0.4)' }}>◉</div>
      <div className="flex-1 max-w-[620px]">
        {/* Header */}
        <div
          className="flex items-center justify-between mb-3 pb-3"
          style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <span className="smallcaps">pre-flight · ground truth</span>
          <span
            className="mono text-[12px] px-2 py-0.5"
            style={{
              background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
              border: `0.5px solid ${ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
              color: ok ? '#34d399' : '#f87171',
            }}
          >
            {hits}/{pf.rows.length} · {pct}%
          </span>
        </div>

        {/* Hit-rate bar */}
        <div
          className="relative h-1 mb-4 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '2px' }}
        >
          <div
            className="absolute left-0 top-0 h-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: ok
                ? 'linear-gradient(to right,#10b981,#34d399)'
                : 'linear-gradient(to right,#ef4444,#f87171)',
              borderRadius: '2px',
            }}
          />
          <div
            className="absolute top-0 h-full w-px"
            style={{ left: '70%', background: 'rgba(255,255,255,0.2)' }}
          />
        </div>

        {/* Rows */}
        <ul className="space-y-1">
          {pf.rows.map((r, i) => (
            <li
              key={i}
              className="grid grid-cols-[10px_1fr_auto] gap-3 items-center py-1.5 px-2"
              style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)', animationDelay: `${i * 30}ms` }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{
                  background: r.matched ? 'linear-gradient(135deg,#34d399,#10b981)' : 'linear-gradient(135deg,#f87171,#ef4444)',
                  boxShadow: r.matched ? '0 0 5px rgba(16,185,129,0.35)' : '0 0 5px rgba(239,68,68,0.25)',
                }}
              />
              <span className="mono text-[12.5px]" style={{ color: 'var(--color-ink-2)' }}>{r.name}</span>
              <span className="mono text-[11px] text-right" style={{ color: r.matched ? '#34d399' : 'var(--color-faded)' }}>
                {r.matched ? '✓' : r.reason}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 coord" style={{ color: ok ? '#34d399' : 'var(--color-faded)' }}>
          {ok ? 'threshold met · ok to run full search' : 'below 70% · surveyor will widen a bucket'}
        </div>
      </div>
    </div>
  );
}
