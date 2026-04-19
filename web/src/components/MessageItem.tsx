import type { Message } from '../lib/types';
import { PreflightCard } from './PreflightCard';
import { ResultsCard } from './ResultsCard';
import { DiagnosisCard } from './DiagnosisCard';

export function MessageItem({ msg }: { msg: Message }) {
  if (msg.kind === 'user') {
    return (
      <div className="rise flex flex-col items-end">
        <div className="coord mb-1.5 select-none" style={{ color: 'rgba(167,139,250,0.4)' }}>you</div>
        <div
          className="max-w-[85%] text-[14.5px] leading-relaxed px-4 py-3"
          style={{
            fontFamily: 'var(--font-sans)',
            background: 'rgba(124,58,237,0.07)',
            borderRight: '2px solid rgba(167,139,250,0.5)',
            color: 'var(--color-ink-2)',
          }}
        >
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.kind === 'assistant') {
    return (
      <div className="rise flex gap-3">
        <div
          className="coord shrink-0 pt-0.5 select-none"
          style={{ color: 'rgba(167,139,250,0.5)' }}
        >
          §
        </div>
        <div
          className="text-[15px] leading-[1.65] max-w-[620px]"
          style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}
        >
          {msg.text.split('\n\n').map((p, i) => (
            <p key={i} className={i > 0 ? 'mt-3' : ''}>
              {p}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (msg.kind === 'tool') {
    return <ToolCall msg={msg} />;
  }

  if (msg.kind === 'card') {
    if (msg.variant === 'preflight') return <PreflightCard />;
    if (msg.variant === 'results') return <ResultsCard />;
    if (msg.variant === 'diagnosis') return <DiagnosisCard />;
    return null;
  }

  if (msg.kind === 'system') {
    return (
      <div
        className="coord rise text-center py-2 px-3"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderTop: '0.5px solid rgba(255,255,255,0.06)',
          borderBottom: '0.5px solid rgba(255,255,255,0.06)',
          color: 'var(--color-faint)',
        }}
      >
        {msg.text}
      </div>
    );
  }

  return null;
}

function ToolCall({
  msg,
}: {
  msg: { kind: 'tool'; name: string; input: any; result: any; id: string; ts: number };
}) {
  if (msg.name === 'enrich_company') {
    const r = msg.result as { found: boolean; attrs?: any; hint?: string };
    const attrs = r.attrs;
    return (
      <div className="rise flex gap-3">
        <div
          className="coord shrink-0 pt-1 select-none"
          style={{ color: 'rgba(167,139,250,0.4)' }}
        >
          ◆
        </div>
        <div
          className="flex-1 max-w-[620px] px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '0.5px solid rgba(255,255,255,0.07)',
            borderLeft: '2px solid rgba(167,139,250,0.3)',
          }}
        >
          <div
            className="mono text-[11px] uppercase tracking-wide mb-2"
            style={{ color: 'rgba(167,139,250,0.5)' }}
          >
            enrich_company · {msg.input?.name}
          </div>
          {!r.found || !attrs ? (
            <div className="text-[13px]" style={{ fontFamily: 'var(--font-sans)', color: '#f87171' }}>
              not in local fixtures — {r.hint || 'unknown'}
            </div>
          ) : (
            <div className="mono text-[13px] leading-relaxed" style={{ color: 'var(--color-ink-2)' }}>
              <span className="font-medium" style={{ color: 'var(--color-ink)' }}>{attrs.name}</span>
              <span style={{ color: 'var(--color-faint)' }}> · </span>
              {attrs.headcount} emp
              <span style={{ color: 'var(--color-faint)' }}> · </span>
              {attrs.industry.join(' + ')}
              <span style={{ color: 'var(--color-faint)' }}> · </span>
              {attrs.region}
              {attrs.tech_used?.length > 0 && (
                <>
                  <span style={{ color: 'var(--color-faint)' }}> · uses </span>
                  {attrs.tech_used.join(', ')}
                </>
              )}
            </div>
          )}
          {attrs?.description && (
            <div
              className="text-[13px] mt-2 leading-snug"
              style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-faded)' }}
            >
              {attrs.description}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}
