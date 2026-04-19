import { useEffect, useMemo, useRef, useState } from 'react';
import { COMPANIES } from '../fixtures/companies';
import type { Company } from '../lib/types';

export function CompanyPicker({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (names: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  // Autofocus search on open; reset state on close.
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
    else {
      setQuery('');
      setSelected(new Set());
    }
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMPANIES;
    return COMPANIES.filter((c) => {
      const blob = `${c.name} ${c.domain} ${c.industry.join(' ')} ${c.region} ${c.description}`.toLowerCase();
      return blob.includes(q);
    });
  }, [query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map((c) => c.id)));
  const clear = () => setSelected(new Set());

  const submit = () => {
    const names = COMPANIES.filter((c) => selected.has(c.id)).map((c) => c.name);
    if (!names.length) return;
    onSubmit(names);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] max-h-[80vh] flex flex-col rise"
        style={{
          background: 'var(--color-paper, #0a0a0a)',
          border: '0.5px solid rgba(255,255,255,0.1)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.4), 0 0 0 1px rgba(124,58,237,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <div className="smallcaps mb-0.5">pick · perfect-fit companies</div>
            <div className="mono text-[11px]" style={{ color: 'var(--color-faded)' }}>
              {selected.size} selected · {filtered.length}/{COMPANIES.length} visible
            </div>
          </div>
          <button
            className="btn-tick"
            onClick={onClose}
            style={{ color: 'var(--color-faded)' }}
          >
            esc
          </button>
        </div>

        {/* Search */}
        <div
          className="px-5 py-3"
          style={{ borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}
        >
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter by name, industry, region, keyword…"
            className="w-full bg-transparent outline-none text-[14px] mono"
            style={{ color: 'var(--color-ink)' }}
          />
        </div>

        {/* Action row */}
        <div
          className="px-5 py-2 flex items-center justify-between coord"
          style={{ color: 'var(--color-faint)', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex gap-3">
            <button onClick={selectAll} className="hover:text-white">select all visible</button>
            <button onClick={clear} className="hover:text-white">clear</button>
          </div>
          <span>{COMPANIES.length} in fixtures</span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scroll-thin">
          {filtered.length === 0 ? (
            <div className="px-5 py-8 text-center coord" style={{ color: 'var(--color-faint)' }}>
              no matches
            </div>
          ) : (
            <ul>
              {filtered.map((c) => (
                <PickerRow
                  key={c.id}
                  c={c}
                  checked={selected.has(c.id)}
                  onToggle={() => toggle(c.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '0.5px solid rgba(255,255,255,0.07)' }}
        >
          <span className="coord" style={{ color: 'var(--color-faint)' }}>
            {selected.size < 10 && selected.size > 0
              ? `${10 - selected.size} more recommended`
              : selected.size >= 10
                ? 'looks good'
                : 'pick ~10 for best results'}
          </span>
          <div className="flex gap-2">
            <button className="btn-tick" onClick={onClose}>
              cancel
            </button>
            <button
              className="btn-tick btn-tick-accent disabled:opacity-30"
              onClick={submit}
              disabled={selected.size === 0}
            >
              add {selected.size > 0 ? selected.size : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PickerRow({
  c,
  checked,
  onToggle,
}: {
  c: Company;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className="px-5 py-2.5 cursor-pointer transition-all duration-100"
      style={{
        borderBottom: '0.5px solid rgba(255,255,255,0.04)',
        background: checked ? 'rgba(124,58,237,0.08)' : 'transparent',
        borderLeft: checked ? '2px solid rgba(167,139,250,0.7)' : '2px solid transparent',
      }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        if (!checked) e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
      }}
      onMouseLeave={(e) => {
        if (!checked) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex items-center justify-center w-[14px] h-[14px] mt-0.5 shrink-0"
          style={{
            border: `0.5px solid ${checked ? '#a78bfa' : 'rgba(255,255,255,0.2)'}`,
            background: checked ? 'rgba(124,58,237,0.3)' : 'transparent',
            borderRadius: '2px',
          }}
        >
          {checked && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 5L4 7L8 3"
                stroke="#a78bfa"
                strokeWidth="1.5"
                strokeLinecap="square"
              />
            </svg>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className="mono text-[13px] truncate"
              style={{ color: checked ? 'var(--color-ink)' : 'var(--color-ink-2)' }}
            >
              {c.name}
            </span>
            <span className="mono text-[10.5px]" style={{ color: 'var(--color-faint)' }}>
              {c.headcount} · {c.region}
            </span>
          </div>
          <div
            className="text-[12px] leading-snug mt-0.5 truncate"
            style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-faded)' }}
          >
            {c.industry.join(' + ')} · {c.description}
          </div>
        </div>
      </div>
    </li>
  );
}
