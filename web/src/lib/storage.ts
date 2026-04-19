import type { Session, Store } from './types';

const KEY = 'contextcon.v2';
const LEGACY_KEY = 'contextcon.v1';

const uid = () => Math.random().toString(36).slice(2, 10);

export const emptySession = (name = 'UNTITLED-PLATE'): Session => {
  const now = Date.now();
  return {
    id: uid(),
    createdAt: now,
    updatedAt: now,
    icp: {
      name,
      product_description: '',
      value_prop: '',
      perfect_fits: [],
      bad_fits: [],
      notes: '',
    },
    filters: [],
    preflight: null,
    results: [],
    scores: {},
    diagnosis: null,
    messages: [],
    iteration: 0,
    history: [],
  };
};

export const emptyStore = (): Store => {
  const first = emptySession();
  return {
    apiKey: null,
    model: 'claude-sonnet-4-5',
    integrations: [
      {
        id: 'crustdata',
        name: 'crustdata',
        label: 'Crustdata',
        key: '',
        endpoint: 'https://api.crustdata.com',
        note: 'primary data source · company + people search, enrichment, web signals',
      },
    ],
    sessions: [first],
    activeId: first.id,
  };
};

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      const base = emptyStore();
      if (!parsed.sessions || parsed.sessions.length === 0) {
        return { ...base, ...parsed, sessions: base.sessions, activeId: base.activeId };
      }
      const activeId =
        parsed.activeId && parsed.sessions.some((s) => s.id === parsed.activeId)
          ? parsed.activeId
          : parsed.sessions[0].id;
      return {
        ...base,
        ...parsed,
        sessions: parsed.sessions,
        activeId,
      };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as any;
      const migrated = emptyStore();
      migrated.apiKey = old.apiKey ?? null;
      migrated.model = old.model ?? migrated.model;
      if (old.integrations) migrated.integrations = old.integrations;
      const sess = emptySession(old.icp?.name || 'UNTITLED-PLATE');
      if (old.icp) sess.icp = old.icp;
      if (Array.isArray(old.filters)) sess.filters = old.filters;
      if (old.preflight) sess.preflight = old.preflight;
      if (Array.isArray(old.results)) sess.results = old.results;
      if (old.scores) sess.scores = old.scores;
      if (old.diagnosis) sess.diagnosis = old.diagnosis;
      if (Array.isArray(old.messages)) sess.messages = old.messages;
      if (typeof old.iteration === 'number') sess.iteration = old.iteration;
      if (Array.isArray(old.history)) sess.history = old.history;
      migrated.sessions = [sess];
      migrated.activeId = sess.id;
      return migrated;
    }
    return emptyStore();
  } catch {
    return emptyStore();
  }
}

export function saveStore(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

export function resetStore() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
}
