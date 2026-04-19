import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Session, Store } from '../lib/types';
import { emptySession, loadStore, resetStore, saveStore } from '../lib/storage';

type Ctx = {
  store: Store;
  session: Session;
  update: (fn: (s: Store) => Store) => void;
  updateSession: (fn: (s: Session) => Session) => void;
  getStore: () => Store;
  getSession: () => Session;
  newSession: () => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, name: string) => void;
  reset: () => void;
};

const StoreContext = createContext<Ctx | null>(null);

function selectSession(s: Store): Session {
  return s.sessions.find((x) => x.id === s.activeId) ?? s.sessions[0];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<Store>(() => {
    const s = loadStore();
    if (!s.sessions?.length) {
      const fresh = emptySession();
      return { ...s, sessions: [fresh], activeId: fresh.id };
    }
    if (!s.sessions.some((x) => x.id === s.activeId)) {
      return { ...s, activeId: s.sessions[0].id };
    }
    return s;
  });
  const ref = useRef(store);

  useEffect(() => {
    ref.current = store;
    saveStore(store);
  }, [store]);

  const update = useCallback((fn: (s: Store) => Store) => {
    setStore((prev) => fn(prev));
  }, []);

  const updateSession = useCallback((fn: (s: Session) => Session) => {
    setStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === prev.activeId ? { ...fn(s), updatedAt: Date.now() } : s
      ),
    }));
  }, []);

  const getStore = useCallback(() => ref.current, []);
  const getSession = useCallback(() => selectSession(ref.current), []);

  const newSession = useCallback(() => {
    const next = emptySession(
      `PLATE-${String(ref.current.sessions.length + 1).padStart(2, '0')}`
    );
    setStore((prev) => ({
      ...prev,
      sessions: [next, ...prev.sessions],
      activeId: next.id,
    }));
    return next.id;
  }, []);

  const switchSession = useCallback((id: string) => {
    setStore((prev) =>
      prev.sessions.some((s) => s.id === id) ? { ...prev, activeId: id } : prev
    );
  }, []);

  const deleteSession = useCallback((id: string) => {
    setStore((prev) => {
      const sessions = prev.sessions.filter((s) => s.id !== id);
      if (sessions.length === 0) {
        const fresh = emptySession();
        return { ...prev, sessions: [fresh], activeId: fresh.id };
      }
      const activeId = prev.activeId === id ? sessions[0].id : prev.activeId;
      return { ...prev, sessions, activeId };
    });
  }, []);

  const renameSession = useCallback((id: string, name: string) => {
    const clean = name.toUpperCase().replace(/\s+/g, '-').slice(0, 48) || 'UNTITLED-PLATE';
    setStore((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) =>
        s.id === id ? { ...s, icp: { ...s.icp, name: clean }, updatedAt: Date.now() } : s
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    resetStore();
    setStore(loadStore());
  }, []);

  const session = useMemo(() => selectSession(store), [store]);

  const value = useMemo(
    () => ({
      store,
      session,
      update,
      updateSession,
      getStore,
      getSession,
      newSession,
      switchSession,
      deleteSession,
      renameSession,
      reset,
    }),
    [
      store,
      session,
      update,
      updateSession,
      getStore,
      getSession,
      newSession,
      switchSession,
      deleteSession,
      renameSession,
      reset,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
