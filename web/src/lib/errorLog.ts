/* Persists browser errors to the Vite dev-server plugin at /__log.
   Read them from web/.errors.log */

type ErrPayload = {
  type: string;
  message?: string;
  stack?: string;
  reason?: string;
  context?: unknown;
};

let installed = false;

export function postError(payload: ErrPayload) {
  try {
    fetch('/__log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

export function installGlobalErrorHandlers() {
  if (installed) return;
  installed = true;

  window.addEventListener('error', (e) => {
    postError({
      type: 'window.error',
      message: e.message,
      stack: e.error?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason: any = e.reason;
    postError({
      type: 'unhandledrejection',
      reason: typeof reason === 'string' ? reason : reason?.message ?? String(reason),
      stack: reason?.stack,
    });
  });

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      postError({
        type: 'console.error',
        message: args
          .map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : safeJson(a)))
          .join(' '),
        stack: args.find((a): a is Error => a instanceof Error)?.stack,
      });
    } catch {}
    origError(...args);
  };
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
