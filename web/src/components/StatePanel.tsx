import { useStore } from '../hooks/useStore';
import { FilterList } from './FilterList';

export function StatePanel() {
  const { session, updateSession } = useStore();
  const { icp, preflight, results, scores, history } = session;

  const fitCount = Object.values(scores).filter((s) => s.fit === 1).length;
  const scoredCount = Object.keys(scores).length;

  return (
    <div className="pt-2 space-y-8 text-[13.5px] pb-24">
      <Section label="§ 01 · plate" delay={0}>
        <input
          className="mono text-sm w-full bg-transparent outline-none border-b hair rule py-1 focus:border-[color:var(--color-vermillion)] transition-colors"
          value={icp.name}
          onChange={(e) => updateSession((s) => ({ ...s, icp: { ...s.icp, name: e.target.value.toUpperCase().replace(/\s+/g, '-') } }))}
        />
      </Section>

      <Section label="§ 02 · product" delay={80}>
        {icp.product_description ? (
          <p className="text-[16px] font-semibold leading-snug" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink)' }}>{icp.product_description}</p>
        ) : (
          <p className="italic text-[color:var(--color-faded)]">
            start by telling the assistant what you sell →
          </p>
        )}
        {icp.value_prop && (
          <p className="mt-2 text-[color:var(--color-faded)] text-[13px] leading-relaxed">
            {icp.value_prop}
          </p>
        )}
      </Section>

      <Section label="§ 03 · ground truth · optional" count={icp.perfect_fits.length} delay={160}>
        {icp.perfect_fits.length === 0 ? (
          <p className="italic text-[color:var(--color-faded)]">
            optional · 2–3 companies you'd love to land, if you have them in mind.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {icp.perfect_fits.map((n) => (
              <li key={n} className="flex items-center gap-2.5 text-[13px]" style={{ fontFamily: 'var(--font-sans)' }}>
                <span className="pip pip-accent" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}
        {icp.bad_fits.length > 0 && (
          <div className="mt-3">
            <div className="coord mb-1.5">exclude</div>
            <ul className="space-y-1">
              {icp.bad_fits.map((n) => (
                <li key={n} className="flex items-center gap-2.5 text-[13px] text-[color:var(--color-faded)]" style={{ fontFamily: 'var(--font-sans)' }}>
                  <span className="pip" />
                  <span className="line-through">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section label="§ 04 · filter query" count={session.filters.length} delay={240}>
        <FilterList />
      </Section>

      {preflight && (
        <Section label="§ 05 · match test">
          <div className="coord mb-2">
            do the filters find the companies you named?
          </div>
          <div className="flex items-baseline justify-between">
            <span className="mono text-sm">
              {preflight.rows.filter((r) => r.matched).length} / {preflight.rows.length} match
            </span>
            <span
              className="mono text-xs"
              style={{
                color:
                  preflight.hitRate >= 0.7
                    ? 'var(--color-oxide)'
                    : 'var(--color-vermillion)',
              }}
            >
              {Math.round(preflight.hitRate * 100)}%
            </span>
          </div>
          <div className="mt-2 h-px bg-[color:var(--color-ink-2)] opacity-20" />
          <div className="mt-2 coord">
            {preflight.hitRate >= 0.7 ? 'threshold met · ok to search' : 'widen a filter to reach 70%'}
          </div>
        </Section>
      )}

      {results.length > 0 && (
        <Section label="§ 06 · last run">
          <div className="mono text-sm">
            {results.length} companies
            {scoredCount > 0 && (
              <>
                <span className="text-[color:var(--color-faded)]"> · </span>
                <span style={{ color: 'var(--color-oxide)' }}>{fitCount} fit</span>
                <span className="text-[color:var(--color-faded)]">
                  {' '}
                  / {scoredCount}
                </span>
              </>
            )}
          </div>
        </Section>
      )}

      <Section label="§ 07 · iterations" count={history.length}>
        {history.length === 0 ? (
          <p className="italic text-[color:var(--color-faded)] text-[12.5px]">
            each filter proposal logs here with its p@10 so you can see which change moved the needle.
          </p>
        ) : (
          <ul className="space-y-1 mono text-[12.5px]">
            {history.slice(-6).map((h, i, arr) => (
              <li
                key={h.iter}
                className="flex items-baseline gap-2"
                style={{
                  color:
                    i === arr.length - 1 ? 'var(--color-ink)' : 'var(--color-faded)',
                }}
              >
                <span className="coord w-5 shrink-0">
                  i{h.iter.toString().padStart(2, '0')}
                </span>
                <span>{h.filters.length} filters</span>
                <span className="ml-auto">
                  {h.p_at_10 == null ? '—' : `${Math.round(h.p_at_10 * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({
  label,
  count,
  delay = 0,
  children,
}: {
  label: string;
  count?: number;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="smallcaps">{label}</span>
        {count != null && (
          <span className="mono text-[11.5px] text-[color:var(--color-faded)]">
            n={count.toString().padStart(2, '0')}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}
