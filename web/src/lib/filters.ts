import type { Company, Filter, PreflightRow } from './types';
import { HEADCOUNT_BUCKETS, REVENUE_BUCKETS } from './types';

const bucketIndex = (buckets: readonly string[], v: string) => buckets.indexOf(v);

function fieldValue(c: Company, field: Filter['field']): string | string[] {
  switch (field) {
    case 'HEADCOUNT':
      return c.headcount;
    case 'INDUSTRY':
      return c.industry;
    case 'REGION':
      return c.region;
    case 'TECH_USED':
      return c.tech_used;
    case 'COMPANY_TYPE':
      return c.company_type;
    case 'REVENUE':
      return c.revenue;
  }
}

function matchOne(c: Company, f: Filter): { ok: boolean; reason?: string } {
  const v = fieldValue(c, f.field);
  const values = Array.isArray(v) ? v : [v];

  const intersects = values.some((x) => f.value.includes(x));

  if (f.op === 'in') {
    if (intersects) return { ok: true };
    return { ok: false, reason: `${f.field} "${values.join(', ')}" ∉ [${f.value.join(', ')}]` };
  }
  if (f.op === 'not_in') {
    if (!intersects) return { ok: true };
    return { ok: false, reason: `${f.field} "${values.join(', ')}" ∈ excluded` };
  }
  if (f.op === 'gte' || f.op === 'lte') {
    const buckets =
      f.field === 'HEADCOUNT' ? HEADCOUNT_BUCKETS : f.field === 'REVENUE' ? REVENUE_BUCKETS : null;
    if (!buckets) return { ok: true };
    const bound = f.value[0];
    const ci = bucketIndex(buckets, values[0]);
    const bi = bucketIndex(buckets, bound);
    if (ci < 0 || bi < 0) return { ok: false, reason: `unknown bucket` };
    const ok = f.op === 'gte' ? ci >= bi : ci <= bi;
    return ok
      ? { ok: true }
      : { ok: false, reason: `${f.field} ${values[0]} ${f.op === 'gte' ? '<' : '>'} ${bound}` };
  }
  return { ok: true };
}

export function matches(c: Company, filters: Filter[]): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let ok = true;
  for (const f of filters) {
    const r = matchOne(c, f);
    if (!r.ok) {
      ok = false;
      reasons.push(r.reason ?? 'no match');
    }
  }
  return { ok, reasons };
}

export function searchCompanies(all: Company[], filters: Filter[]): Company[] {
  if (!filters.length) return [];
  return all.filter((c) => matches(c, filters).ok);
}

export function preflight(all: Company[], perfectFitNames: string[], filters: Filter[]): {
  rows: PreflightRow[];
  hitRate: number;
} {
  const rows: PreflightRow[] = perfectFitNames.map((name) => {
    const c = all.find(
      (x) => x.name.toLowerCase() === name.toLowerCase() || x.domain.toLowerCase() === name.toLowerCase()
    );
    if (!c) {
      return { name, matched: false, reason: 'not in local fixtures (would be enriched live)' };
    }
    const r = matches(c, filters);
    if (r.ok) return { name, matched: true, reason: '' };
    return { name, matched: false, reason: r.reasons[0] ?? 'filter mismatch' };
  });
  const hits = rows.filter((r) => r.matched).length;
  return { rows, hitRate: rows.length ? hits / rows.length : 0 };
}
