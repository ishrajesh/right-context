import { useEffect, useState } from 'react';
import { useStore } from '../hooks/useStore';
import type { Integration } from '../lib/types';

const MODELS = [
  { id: 'claude-sonnet-4-5', label: 'claude-sonnet-4-5  · balanced' },
  { id: 'claude-opus-4-5', label: 'claude-opus-4-5  · heaviest' },
  { id: 'claude-haiku-4-5', label: 'claude-haiku-4-5 · fastest' },
];

const uid = () => Math.random().toString(36).slice(2, 10);

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { store, update, reset } = useStore();
  const [apiKey, setApiKey] = useState(store.apiKey ?? '');
  const [model, setModel] = useState(store.model);
  const [integrations, setIntegrations] = useState<Integration[]>(store.integrations ?? []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = () => {
    update((s) => ({
      ...s,
      apiKey: apiKey.trim() || null,
      model,
      integrations: integrations.map((i) => ({ ...i, key: i.key.trim(), name: i.name.trim(), label: i.label.trim() })),
    }));
    onClose();
  };

  const updateIntegration = (id: string, patch: Partial<Integration>) => {
    setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const removeIntegration = (id: string) =>
    setIntegrations((prev) => prev.filter((i) => i.id !== id));
  const addIntegration = () =>
    setIntegrations((prev) => [
      ...prev,
      { id: uid(), name: 'provider', label: 'Provider', key: '', endpoint: '', note: '' },
    ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(7,7,26,0.7)' }}
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative w-full max-w-xl p-8 rise"
        style={{
          background: 'var(--color-paper-2)',
          border: '0.5px solid rgba(167,139,250,0.2)',
          boxShadow: '0 0 0 1px rgba(124,58,237,0.12), 0 24px 48px rgba(0,0,0,0.5), 0 0 80px rgba(124,58,237,0.08)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(124,58,237,0.08), transparent 60%)',
          }}
        />
        <div className="relative flex items-baseline justify-between mb-6">
          <div>
            <div className="smallcaps mb-1">settings · instrument</div>
            <h2 className="display text-[28px] font-bold leading-none" style={{
              background: 'linear-gradient(120deg,#a78bfa,#6366f1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>Calibrate the surveyor</h2>
          </div>
          <button className="btn-tick" onClick={onClose}>esc</button>
        </div>

        <div className="relative space-y-5">
          <Field
            label="anthropic api key"
            hint="stored in localStorage · never leaves the browser"
          >
            <input
              type="password"
              autoComplete="off"
              placeholder="sk-ant-…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full mono text-[13px] bg-transparent outline-none border-b hair rule py-1.5 focus:border-[color:var(--color-vermillion)]"
            />
          </Field>

          <Field label="model" hint="opus for hardest diagnoses; sonnet is fine for most work">
            <div className="space-y-1">
              {MODELS.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 mono text-[12.5px] cursor-pointer py-0.5"
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={model === m.id}
                    onChange={() => setModel(m.id)}
                    className="accent-[color:var(--color-vermillion)]"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </Field>

          <Field
            label="data providers · right context api integrations"
            hint="upstream sources for company/contact data. stored in localStorage; the MVP runs on local fixtures until wired up."
          >
            <div className="space-y-3">
              {integrations.map((ig) => (
                <IntegrationRow
                  key={ig.id}
                  ig={ig}
                  onChange={(patch) => updateIntegration(ig.id, patch)}
                  onRemove={() => removeIntegration(ig.id)}
                />
              ))}
              <button className="btn-tick" onClick={addIntegration}>
                + add provider
              </button>
            </div>
          </Field>

          <Field label="danger" hint="wipes this plate and all iterations">
            <button
              className="btn-tick btn-tick-accent"
              onClick={() => {
                if (confirm('reset all data? this clears the plate, iterations, and api key.')) {
                  reset();
                  onClose();
                }
              }}
            >
              reset all · wipe localStorage
            </button>
          </Field>
        </div>

        <div className="mt-8 pt-4 border-t hair rule flex justify-end gap-2">
          <button className="btn-tick" onClick={onClose}>
            cancel
          </button>
          <button className="btn-tick btn-tick-accent" onClick={save}>
            save
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="smallcaps mb-1.5">{label}</div>
      <div>{children}</div>
      {hint && <div className="coord mt-1.5">{hint}</div>}
    </div>
  );
}

function IntegrationRow({
  ig,
  onChange,
  onRemove,
}: {
  ig: Integration;
  onChange: (patch: Partial<Integration>) => void;
  onRemove: () => void;
}) {
  const connected = !!ig.key.trim();
  return (
    <div
      className="border hair rule pl-3 pr-2 py-2.5 relative"
      style={{
        borderLeft: `2px solid ${
          connected ? 'var(--color-oxide)' : 'var(--color-paper-shadow)'
        }`,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <input
            value={ig.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Provider name"
            className="display text-[15px] bg-transparent outline-none min-w-0 w-40 border-b hair rule py-0.5 focus:border-[color:var(--color-vermillion)]"
          />
          <span
            className="coord"
            style={{ color: connected ? 'var(--color-oxide)' : 'var(--color-faded)' }}
          >
            {connected ? '● connected' : '○ not set'}
          </span>
        </div>
        <button
          className="mono text-[10px] text-[color:var(--color-vermillion)] opacity-60 hover:opacity-100 transition-opacity"
          onClick={onRemove}
          title="remove integration"
        >
          remove
        </button>
      </div>
      <div className="grid grid-cols-[70px_1fr] gap-x-3 gap-y-1.5 items-baseline">
        <span className="coord">key</span>
        <input
          type="password"
          autoComplete="off"
          placeholder="paste api key"
          value={ig.key}
          onChange={(e) => onChange({ key: e.target.value })}
          className="mono text-[12px] bg-transparent outline-none border-b hair rule py-0.5 focus:border-[color:var(--color-vermillion)]"
        />
        <span className="coord">endpoint</span>
        <input
          placeholder="https://api.example.com"
          value={ig.endpoint ?? ''}
          onChange={(e) => onChange({ endpoint: e.target.value })}
          className="mono text-[12px] bg-transparent outline-none border-b hair rule py-0.5 focus:border-[color:var(--color-vermillion)]"
        />
        <span className="coord">note</span>
        <input
          placeholder="what this is used for"
          value={ig.note ?? ''}
          onChange={(e) => onChange({ note: e.target.value })}
          className="text-[12px] bg-transparent outline-none border-b hair rule py-0.5 focus:border-[color:var(--color-vermillion)]"
        />
      </div>
    </div>
  );
}
