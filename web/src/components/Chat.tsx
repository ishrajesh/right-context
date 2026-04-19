import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../hooks/useStore';
import { runAgentTurn, type ExecutedTool } from '../lib/agent';
import type { Message } from '../lib/types';
import { MessageItem } from './MessageItem';
import { CompanyPicker } from './CompanyPicker';

const uid = () => Math.random().toString(36).slice(2, 10);

export function Chat() {
  const { store, session, update, updateSession, getStore } = useStore();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [session.messages.length, busy]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      if (!store.apiKey) {
        setError('add an api key first (⌘,)');
        return;
      }
      setError(null);
      setBusy(true);

      const userMsg: Message = { id: uid(), kind: 'user', text, ts: Date.now() };
      updateSession((s) => ({ ...s, messages: [...s.messages, userMsg] }));
      setInput('');

      await runAgentTurn({
        store: getStore(),
        update,
        getStore,
        userText: text,
        onAssistantText: (t) => {
          updateSession((s) => ({
            ...s,
            messages: [
              ...s.messages,
              { id: uid(), kind: 'assistant', text: t, ts: Date.now() },
            ],
          }));
        },
        onToolCall: (tool: ExecutedTool) => {
          const surfaced = new Set(['enrich_company']);
          if (!surfaced.has(tool.name)) return;
          updateSession((s) => ({
            ...s,
            messages: [
              ...s.messages,
              {
                id: uid(),
                kind: 'tool',
                name: tool.name,
                input: tool.input,
                result: tool.result,
                ts: Date.now(),
              },
            ],
          }));
        },
        onError: (err) => setError(err),
      });

      setBusy(false);
    },
    [busy, update, updateSession, getStore, store.apiKey]
  );

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      send(input);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const showGreeting = session.messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-baseline justify-between mb-4">
        <span className="smallcaps">§ intake assistant</span>
        <span className="coord">{session.messages.length.toString().padStart(3, '0')} entries</span>
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto scroll-thin pr-2 pb-6 min-h-0">
        {showGreeting && <Greeting hasKey={!!store.apiKey} />}

        <div className="space-y-5 max-w-[680px]">
          {session.messages.map((m) => (
            <MessageItem key={m.id} msg={m} />
          ))}
          {busy && (
            <div className="flex items-center gap-2.5 mono text-[12px] rise" style={{ color: 'var(--color-faded)' }}>
              <span className="coord select-none" style={{ color: 'rgba(167,139,250,0.5)' }}>§</span>
              <span className="flex items-end gap-[3px]">
                <span className="dot-1 inline-block w-[5px] h-[5px] rounded-sm" style={{ background: 'linear-gradient(135deg,#a78bfa,#6366f1)' }} />
                <span className="dot-2 inline-block w-[5px] h-[5px] rounded-sm" style={{ background: 'linear-gradient(135deg,#a78bfa,#6366f1)' }} />
                <span className="dot-3 inline-block w-[5px] h-[5px] rounded-sm" style={{ background: 'linear-gradient(135deg,#a78bfa,#6366f1)' }} />
              </span>
              <span>surveying</span>
            </div>
          )}
          {error && (
            <div
              className="mono text-[12px] px-3 py-2 rise"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '0.5px solid rgba(239,68,68,0.3)',
                color: '#f87171',
              }}
            >
              ! {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onKey={onKey}
        onSend={() => send(input)}
        onPick={() => setPickerOpen(true)}
        busy={busy}
      />

      <CompanyPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSubmit={(names) => {
          const msg = `perfect-fit companies: ${names.join(', ')}.`;
          send(msg);
        }}
      />
    </div>
  );
}

function Greeting({ hasKey }: { hasKey: boolean }) {
  return (
    <div className="mb-10 max-w-[560px]">
      <div className="flex items-start gap-5 mb-6 rise">
        <span
          className="display select-none shrink-0 font-extrabold"
          style={{
            fontSize: '96px',
            lineHeight: 1,
            marginTop: '-6px',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.1))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          00
        </span>
        <div className="pt-1 flex-1">
          <div className="smallcaps mb-3">intake · survey</div>
          <h1 className="display text-[36px] font-bold leading-[1.05] tracking-tight">
            What do you{' '}
            <span
              style={{
                background: 'linear-gradient(120deg,#a78bfa,#6366f1,#38bdf8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              sell
            </span>
            , and to whom?
          </h1>
        </div>
      </div>

      <p
        className="text-[15px] leading-relaxed pl-4 rise"
        style={{
          borderLeft: '2px solid rgba(124,58,237,0.35)',
          color: 'var(--color-faded)',
          animationDelay: '80ms',
        }}
      >
        Answer in one or two sentences. I'll invite you to pick ~10 real companies
        you'd love to land, enrich each, and plot a filter query from the pattern.
      </p>

      {!hasKey && (
        <div
          className="mt-5 inline-flex items-center gap-2 mono text-[11px] px-3 py-1.5 rise"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '0.5px solid rgba(239,68,68,0.35)',
            color: '#f87171',
            animationDelay: '160ms',
          }}
        >
          <span>!</span>
          <span>add anthropic api key · ⌘,</span>
        </div>
      )}
    </div>
  );
}

function ChatInput({
  value,
  onChange,
  onKey,
  onSend,
  onPick,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onPick: () => void;
  busy: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="pt-4 transition-all duration-200"
      style={{
        borderTop: `0.5px solid ${focused ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={2}
          placeholder="say something to the surveyor…"
          className="w-full bg-transparent outline-none resize-none text-[15px] leading-relaxed pr-36"
          style={{
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-ink)',
          }}
        />
        <div className="absolute right-0 top-0 flex items-center gap-2">
          <button
            className="btn-tick disabled:opacity-30"
            onClick={onPick}
            disabled={busy}
            title="pick perfect-fit companies from a list"
          >
            ⊞ pick
          </button>
          <span className="coord">↵</span>
          <button
            className="btn-tick btn-tick-accent disabled:opacity-30"
            onClick={onSend}
            disabled={busy || !value.trim()}
          >
            send
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between coord">
        <span>⌘↵ to send · ⊞ to pick</span>
        <span>{value.length.toString().padStart(4, '0')} ch</span>
      </div>
    </div>
  );
}
