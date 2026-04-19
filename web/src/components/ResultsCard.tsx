import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import type { Company } from '../lib/types';

export function ResultsCard() {
  const { session, updateSession } = useStore();
  const { results, scores, icp } = session;
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!results.length) return null;

  const scored = Object.keys(scores).length > 0;
  const fitCount = Object.values(scores).filter((s) => s.fit === 1).length;

  const addBadFit = (c: Company) => {
    updateSession((s) => ({
      ...s,
      icp: {
        ...s.icp,
        bad_fits: s.icp.bad_fits.includes(c.name) ? s.icp.bad_fits : [...s.icp.bad_fits, c.name],
      },
    }));
  };

  const exportCsv = () => {
    const rows = [
      ['name', 'domain', 'headcount', 'region', 'industry', 'tech_used', 'fit', 'reason'].join(','),
      ...results.map((c) => {
        const s = scores[c.id];
        return [
          c.name, c.id, c.headcount, c.region,
          `"${c.industry.join('|')}"`,
          `"${c.tech_used.join('|')}"`,
          s?.fit ?? '',
          `"${(s?.reason || '').replace(/"/g, "'")}"`,
        ].join(',');
      }),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${icp.name || 'right-context'}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rise flex gap-3">
      <div className="coord shrink-0 pt-1 select-none" style={{ color: 'rgba(167,139,250,0.4)' }}>⊞</div>
      <div className="flex-1 max-w-[680px]">
        {/* Header */}
        <div
          className="flex items-center justify-between mb-3 pb-3"
          style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <span className="smallcaps">results · page 01</span>
            {scored && (
              <span
                className="mono text-[10px] px-2 py-0.5"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '0.5px solid rgba(16,185,129,0.3)',
                  color: '#34d399',
                }}
              >
                p@{results.length} {Math.round((fitCount / results.length) * 100)}%
              </span>
            )}
          </div>
          <span className="mono text-[11px]" style={{ color: 'var(--color-faded)' }}>
            {results.length} companies
          </span>
        </div>

        {/* List */}
        <ul>
          {results.map((c, i) => {
            const s = scores[c.id];
            const isOpen = expanded === c.id;
            const isFit = s?.fit === 1;
            const isMiss = s?.fit === 0;

            return (
              <li
                key={c.id}
                className="rise"
                style={{
                  animationDelay: `${i * 20}ms`,
                  borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                }}
              >
                <button
                  className="w-full grid grid-cols-[10px_1fr_auto_auto] gap-3 items-center py-2.5 text-left px-2 transition-all duration-150"
                  style={{ borderRadius: '4px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                >
                  {/* Fit indicator */}
                  {!scored ? (
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.15)' }}
                    />
                  ) : isFit ? (
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: 'linear-gradient(135deg,#34d399,#10b981)', boxShadow: '0 0 6px rgba(16,185,129,0.4)' }}
                    />
                  ) : (
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: 'linear-gradient(135deg,#f87171,#ef4444)', boxShadow: '0 0 6px rgba(239,68,68,0.3)' }}
                    />
                  )}

                  <span className="mono text-[12.5px] truncate" style={{ color: 'var(--color-ink-2)' }}>
                    {c.name}
                  </span>
                  <span className="mono text-[11px]" style={{ color: 'var(--color-faint)' }}>
                    {c.headcount}
                  </span>
                  <span className="mono text-[11px] text-right" style={{ color: 'var(--color-faint)', minWidth: '80px' }}>
                    {c.region}
                  </span>
                </button>

                {isOpen && (
                  <div
                    className="pl-5 pr-2 pb-3 pt-1 rise"
                    style={{ borderLeft: '2px solid rgba(255,255,255,0.06)', marginLeft: '6px' }}
                  >
                    <div
                      className="text-[13px] leading-snug mb-2"
                      style={{ color: 'var(--color-faded)' }}
                    >
                      {c.description}
                    </div>
                    <div className="mono text-[11px] flex flex-wrap gap-x-4 gap-y-1" style={{ color: 'var(--color-faint)' }}>
                      <span>{c.industry.join(' + ')}</span>
                      {c.tech_used.length > 0 && <span>uses {c.tech_used.join(', ')}</span>}
                      <span>{c.company_type}</span>
                      <span>{c.revenue}</span>
                    </div>
                    {s && (
                      <div
                        className="mt-2.5 text-[12.5px] pl-3 py-1"
                        style={{
                          borderLeft: `2px solid ${isFit ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.5)'}`,
                          color: isFit ? '#34d399' : '#f87171',
                        }}
                      >
                        <span className="coord mr-2" style={{ color: 'inherit', opacity: 0.7 }}>
                          {isFit ? 'fit' : 'miss'}
                        </span>
                        <span style={{ color: 'var(--color-faded)' }}>{s.reason}</span>
                      </div>
                    )}
                    <div className="mt-2.5 flex gap-2">
                      <button
                        className="btn-tick"
                        onClick={(e) => { e.stopPropagation(); addBadFit(c); }}
                      >
                        mark bad fit
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          <span className="coord" style={{ color: scored ? (fitCount > 0 ? '#34d399' : 'var(--color-faint)') : 'var(--color-faint)' }}>
            {scored ? `${fitCount} fit · ${results.length - fitCount} miss` : 'awaiting score'}
          </span>
          <button className="btn-tick" onClick={exportCsv}>
            export csv
          </button>
        </div>
      </div>
    </div>
  );
}
