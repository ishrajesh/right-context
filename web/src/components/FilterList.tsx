import { useStore } from '../hooks/useStore';
import type { Filter } from '../lib/types';

export function FilterList() {
  const { session, updateSession } = useStore();
  const { filters } = session;

  if (!filters.length) {
    return (
      <div className="space-y-2">
        <p className="italic text-[color:var(--color-faded)] text-[12.5px]">
          no filters plotted yet. the surveyor will propose them once you describe your product.
        </p>
        <div className="mt-3 opacity-40 select-none">
          <div className="text-[10px] coord mb-1.5">example · what a filter looks like here</div>
          <div className="flex items-baseline gap-2 pl-2.5 border-l-2" style={{ borderColor: 'var(--color-paper-shadow)' }}>
            <span className="coord w-5 shrink-0">s01</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="mono text-[13px]">
                  <span className="font-medium">TECH_USED</span>
                  <span className="mx-1">∈</span>
                  <span>Clio, MyCase</span>
                </div>
                <div className="flex items-center gap-0">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={`pip ${i <= 4 ? 'pip-accent' : ''}`}
                      style={{ width: 5, height: 5, marginRight: 1 }}
                    />
                  ))}
                </div>
              </div>
              <div className="text-[12.5px] text-[color:var(--color-faded)] leading-snug mt-1" style={{ fontFamily: 'var(--font-sans)' }}>
                highest-precision signal per the filter-strategy docs
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const remove = (id: string) =>
    updateSession((s) => ({ ...s, filters: s.filters.filter((f) => f.id !== id) }));

  return (
    <ul className="space-y-3">
      {filters.map((f, i) => (
        <li
          key={f.id}
          className="group relative rise pl-2.5"
          style={{
            animationDelay: `${i * 40}ms`,
            borderLeft: `2px solid ${
              f.confidence >= 4
                ? 'rgba(124,58,237,0.7)'
                : f.confidence >= 3
                ? 'rgba(99,102,241,0.4)'
                : 'rgba(255,255,255,0.1)'
            }`,
          }}
        >
          <div className="flex items-baseline gap-2">
            <span className="coord w-5 shrink-0">s{String(i + 1).padStart(2, '0')}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <div className="mono text-[13px] truncate">
                  <span className="font-medium">{f.field}</span>
                  <span className="mx-1 text-[color:var(--color-faded)]">{opSym(f.op)}</span>
                  <span className="text-[color:var(--color-ink-2)]">
                    {f.value.length > 3 ? `${f.value.slice(0, 2).join(', ')}, +${f.value.length - 2}` : f.value.join(', ')}
                  </span>
                </div>
                <Confidence level={f.confidence} />
              </div>
              {f.rationale && (
                <div className="text-[12.5px] text-[color:var(--color-faded)] leading-snug mt-1 pr-4" style={{ fontFamily: 'var(--font-sans)' }}>
                  {f.rationale}
                </div>
              )}
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 mono text-[10px] text-[color:var(--color-vermillion)] transition-opacity px-1"
              onClick={() => remove(f.id)}
              title="remove filter"
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function opSym(op: Filter['op']): string {
  return op === 'in' ? '∈' : op === 'not_in' ? '∉' : op === 'gte' ? '≥' : '≤';
}

function Confidence({ level }: { level: Filter['confidence'] }) {
  return (
    <div className="flex items-center gap-0" title={`confidence ${level}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`pip ${i <= level ? 'pip-accent' : ''}`}
          style={{ width: 5, height: 5, marginRight: 1 }}
        />
      ))}
    </div>
  );
}
