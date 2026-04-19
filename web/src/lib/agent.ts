import Anthropic from '@anthropic-ai/sdk';
import type { Filter, Session, Store } from './types';
import { COMPANIES } from '../fixtures/companies';
import { preflight, searchCompanies } from './filters';
import { SYSTEM_PROMPT } from './prompts';
import { postError } from './errorLog';

// Session helpers
function getSession(store: Store): Session {
  return store.sessions.find((s) => s.id === store.activeId) ?? store.sessions[0];
}

function patchSession(store: Store, fn: (s: Session) => Session): Store {
  return {
    ...store,
    sessions: store.sessions.map((s) =>
      s.id === store.activeId ? { ...fn(s), updatedAt: Date.now() } : s
    ),
  };
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'enrich_company',
    description:
      'Look up a company by name or domain in local fixtures. Returns attributes (headcount, industry, region, tech_used, etc.) if found.',
    input_schema: {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    },
  },
  {
    name: 'update_icp',
    description:
      'Patch the ICP state. Use to save product_description, value_prop, perfect_fits, bad_fits, or notes as you learn them.',
    input_schema: {
      type: 'object',
      properties: {
        product_description: { type: 'string' },
        value_prop: { type: 'string' },
        perfect_fits: { type: 'array', items: { type: 'string' } },
        bad_fits: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
    },
  },
  {
    name: 'propose_filters',
    description:
      'Replace the current filter query with a new proposed list. Each filter needs field, op, value (array of strings), rationale (one short clause), and confidence 1-5.',
    input_schema: {
      type: 'object',
      properties: {
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                enum: ['HEADCOUNT', 'INDUSTRY', 'REGION', 'TECH_USED', 'COMPANY_TYPE', 'REVENUE'],
              },
              op: { type: 'string', enum: ['in', 'not_in', 'gte', 'lte'] },
              value: { type: 'array', items: { type: 'string' } },
              rationale: { type: 'string' },
              confidence: { type: 'integer', minimum: 1, maximum: 5 },
            },
            required: ['field', 'op', 'value', 'rationale', 'confidence'],
          },
        },
      },
      required: ['filters'],
    },
  },
  {
    name: 'run_preflight',
    description:
      'Run the ground-truth match test: do the current filters include each perfect-fit company? Returns rows with matched/reason and overall hitRate.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'run_search',
    description:
      'Execute the current filter query against the fixture dataset. Returns companies that match.',
    input_schema: {
      type: 'object',
      properties: {
        page: { type: 'integer' },
        limit: { type: 'integer' },
      },
    },
  },
  {
    name: 'score_results',
    description:
      'After run_search, score every returned company. Each score: companyId, fit (0 or 1), one-line reason.',
    input_schema: {
      type: 'object',
      properties: {
        scores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              companyId: { type: 'string' },
              fit: { type: 'integer', enum: [0, 1] },
              reason: { type: 'string' },
            },
            required: ['companyId', 'fit', 'reason'],
          },
        },
      },
      required: ['scores'],
    },
  },
  {
    name: 'submit_diagnosis',
    description:
      'After scoring, submit a diagnosis. Include p_at_10 (0-1), top_category ("wrong-industry", "wrong-size", "wrong-geo", "wrong-tech", "wrong-model", "already-customer"), counts per category, and ONE single-axis proposal as a sentence.',
    input_schema: {
      type: 'object',
      properties: {
        p_at_10: { type: 'number' },
        top_category: { type: 'string' },
        counts: { type: 'object' },
        proposal: { type: 'string' },
      },
      required: ['p_at_10', 'top_category', 'counts', 'proposal'],
    },
  },
];

export type ToolName =
  | 'enrich_company'
  | 'update_icp'
  | 'propose_filters'
  | 'run_preflight'
  | 'run_search'
  | 'score_results'
  | 'submit_diagnosis';

export type StoreUpdater = (updater: (s: Store) => Store) => void;

export type ExecutedTool = {
  name: ToolName;
  input: any;
  result: any;
  cardId?: string;
};

const uid = () => Math.random().toString(36).slice(2, 10);

export function executeTool(name: ToolName, input: any, store: Store, update: StoreUpdater): ExecutedTool {
  switch (name) {
    case 'enrich_company': {
      const q = String(input.name || '').toLowerCase();
      const c = COMPANIES.find(
        (x) => x.name.toLowerCase() === q || x.domain.toLowerCase() === q
      );
      if (!c) {
        return { name, input, result: { found: false, hint: 'not in local fixtures; treat as unknown and proceed' } };
      }
      return {
        name,
        input,
        result: {
          found: true,
          attrs: {
            name: c.name, headcount: c.headcount, industry: c.industry,
            region: c.region, hq_city: c.hq_city, tech_used: c.tech_used,
            company_type: c.company_type, revenue: c.revenue, description: c.description,
          },
        },
      };
    }

    case 'update_icp': {
      update((s) => patchSession(s, (sess) => ({ ...sess, icp: { ...sess.icp, ...input } })));
      return { name, input, result: { ok: true } };
    }

    case 'propose_filters': {
      const filters: Filter[] = (input.filters || []).map((f: any) => ({
        id: uid(),
        field: f.field,
        op: f.op,
        value: Array.isArray(f.value) ? f.value : [f.value],
        rationale: f.rationale,
        confidence: f.confidence,
      }));
      update((s) =>
        patchSession(s, (sess) => ({
          ...sess,
          filters,
          preflight: null,
          results: [],
          scores: {},
          diagnosis: null,
          iteration: sess.iteration + 1,
          history: [
            ...sess.history,
            { iter: sess.iteration + 1, filters, p_at_10: null, ts: Date.now() },
          ],
        }))
      );
      return { name, input, result: { ok: true, count: filters.length } };
    }

    case 'run_preflight': {
      const sess = getSession(store);
      const { filters, icp } = sess;
      if (!filters.length) return { name, input, result: { ok: false, error: 'no filters proposed yet' } };
      if (!icp.perfect_fits.length) return { name, input, result: { ok: false, error: 'no perfect_fits set on ICP' } };
      const pf = preflight(COMPANIES, icp.perfect_fits, filters);
      const cardId = uid();
      update((s) =>
        patchSession(s, (sess) => ({
          ...sess,
          preflight: { ...pf, filterSnapshot: filters },
          messages: [
            ...sess.messages,
            { id: cardId, kind: 'card' as const, variant: 'preflight' as const, refId: cardId, ts: Date.now() },
          ],
        }))
      );
      return { name, input, result: { hitRate: pf.hitRate, rows: pf.rows }, cardId };
    }

    case 'run_search': {
      const sess = getSession(store);
      const { filters } = sess;
      if (!filters.length) return { name, input, result: { ok: false, error: 'no filters' } };
      const limit = Math.min(Number(input.limit) || 10, 25);
      const all = searchCompanies(COMPANIES, filters);
      const results = all.slice(0, limit);
      const cardId = uid();
      update((s) =>
        patchSession(s, (sess) => ({
          ...sess,
          results,
          scores: {},
          diagnosis: null,
          messages: [
            ...sess.messages,
            { id: cardId, kind: 'card' as const, variant: 'results' as const, refId: cardId, ts: Date.now() },
          ],
        }))
      );
      return {
        name, input,
        result: {
          total: all.length, returned: results.length,
          companies: results.map((c) => ({
            id: c.id, name: c.name, headcount: c.headcount, industry: c.industry,
            region: c.region, tech_used: c.tech_used, company_type: c.company_type, description: c.description,
          })),
        },
        cardId,
      };
    }

    case 'score_results': {
      const scores = (input.scores || []) as { companyId: string; fit: 0 | 1; reason: string }[];
      update((s) =>
        patchSession(s, (sess) => {
          const next = { ...sess.scores };
          for (const sc of scores) next[sc.companyId] = sc;
          return { ...sess, scores: next };
        })
      );
      const fitCount = scores.filter((x) => x.fit === 1).length;
      return { name, input, result: { ok: true, fit: fitCount, total: scores.length, p_at_10: scores.length ? fitCount / scores.length : 0 } };
    }

    case 'submit_diagnosis': {
      const sess = getSession(store);
      const d = {
        p_at_10: Number(input.p_at_10) || 0,
        top_category: String(input.top_category || ''),
        counts: input.counts || {},
        proposal: String(input.proposal || ''),
        accepted: null as null | boolean,
        filterSnapshot: sess.filters,
      };
      const cardId = uid();
      update((s) =>
        patchSession(s, (sess) => ({
          ...sess,
          diagnosis: d,
          history: sess.history.map((h, i) =>
            i === sess.history.length - 1 ? { ...h, p_at_10: d.p_at_10 } : h
          ),
          messages: [
            ...sess.messages,
            { id: cardId, kind: 'card' as const, variant: 'diagnosis' as const, refId: cardId, ts: Date.now() },
          ],
        }))
      );
      return { name, input, result: { ok: true } };
    }
  }
}

export async function runAgentTurn(params: {
  store: Store;
  update: StoreUpdater;
  getStore: () => Store;
  userText: string;
  onAssistantText: (text: string) => void;
  onToolCall: (tool: ExecutedTool) => void;
  onError: (err: string) => void;
}) {
  const { getStore, update, userText, onAssistantText, onToolCall, onError } = params;
  const { apiKey, model } = getStore();
  if (!apiKey) {
    onError('No API key set. Open settings (⌘,) to add your Anthropic key.');
    return;
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const apiMessages = buildApiMessages(getStore(), userText);
  const systemPrompt = buildSystemPrompt(getStore());

  let guard = 0;
  while (guard++ < 12) {
    let resp: Anthropic.Message;
    try {
      resp = await client.messages.create({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOLS,
        messages: apiMessages,
      });
    } catch (e: any) {
      const msg = e?.message || 'model call failed';
      postError({
        type: 'agent.api',
        message: msg,
        stack: e?.stack,
        context: {
          guard,
          lastMessageRoles: apiMessages.slice(-6).map((m) => m.role),
          status: e?.status,
        },
      });
      onError(msg);
      return;
    }

    const textBlocks = resp.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
    const toolUses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

    for (const t of textBlocks) {
      if (t.text.trim()) onAssistantText(t.text);
    }

    apiMessages.push({ role: 'assistant', content: resp.content });

    if (!toolUses.length || resp.stop_reason !== 'tool_use') return;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const executed = executeTool(use.name as ToolName, use.input as any, getStore(), update);
      onToolCall(executed);
      toolResults.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(executed.result) });
    }

    apiMessages.push({ role: 'user', content: toolResults });
  }

  onError('agent loop exceeded max iterations');
}

function buildApiMessages(store: Store, newUserText: string): Anthropic.MessageParam[] {
  const sess = getSession(store);
  const msgs: Anthropic.MessageParam[] = [];

  // Collapse stored history into strictly-alternating user/assistant turns.
  // Consecutive same-role entries get merged so Anthropic's API never sees
  // two user messages in a row.
  let lastRole: 'user' | 'assistant' | null = null;
  const push = (role: 'user' | 'assistant', content: string) => {
    if (!content.trim()) return;
    if (lastRole === role) {
      const prev = msgs[msgs.length - 1];
      prev.content = `${prev.content as string}\n\n${content}`;
      return;
    }
    msgs.push({ role, content });
    lastRole = role;
  };

  for (const m of sess.messages) {
    if (m.kind === 'user') push('user', m.text);
    else if (m.kind === 'assistant' && !m.pending) push('assistant', m.text);
  }

  push('user', newUserText);

  // The API requires the first message to be user. If by some path we got an
  // assistant first, drop it; the system prompt carries state snapshot anyway.
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

function buildSystemPrompt(store: Store): string {
  const snapshot = stateSnapshot(store);
  return snapshot ? `${SYSTEM_PROMPT}\n\n${snapshot}` : SYSTEM_PROMPT;
}

function stateSnapshot(store: Store): string | null {
  const s = getSession(store);
  const parts: string[] = [];
  if (s.icp.product_description) parts.push(`PRODUCT: ${s.icp.product_description}`);
  if (s.icp.value_prop) parts.push(`VALUE_PROP: ${s.icp.value_prop}`);
  if (s.icp.perfect_fits.length) parts.push(`PERFECT_FITS: ${s.icp.perfect_fits.join(', ')}`);
  if (s.icp.bad_fits.length) parts.push(`BAD_FITS: ${s.icp.bad_fits.join(', ')}`);
  if (s.filters.length)
    parts.push(`FILTERS: ${s.filters.map((f) => `${f.field} ${f.op} [${f.value.join('|')}]`).join(' ; ')}`);
  if (s.preflight) parts.push(`PREFLIGHT_HITRATE: ${s.preflight.hitRate.toFixed(2)}`);
  if (s.diagnosis) parts.push(`LAST_P_AT_10: ${s.diagnosis.p_at_10.toFixed(2)}`);
  parts.push(`ITERATION: ${s.iteration}`);
  if (!parts.length) return null;
  return `[STATE SNAPSHOT]\n${parts.join('\n')}\n[END SNAPSHOT]`;
}
