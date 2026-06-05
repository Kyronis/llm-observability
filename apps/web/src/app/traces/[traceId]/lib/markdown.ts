/**
 * 将 Trace 序列化为 LLM 友好的 Markdown+XML。
 * 关键约定：依赖 <input>/<system_prompt>/<user_input>/<output> 等 XML 标签结构，
 * 下游 LLM 处理管道依赖此结构做"系统提示 / 用户输入 / 模型输出"的拆分。
 */

import type { Observation } from '@llm-observability/shared/schemas/project';
import {
  extractContent,
  hasFormattableContent,
  type RoleBlock,
} from './format';
import { aggregateTokenUsage } from './usage';

const GENAI_PROMPT_KEYS = [
  'gen_ai.system_prompt',
  'gen_ai.system',
  'gen_ai.prompt',
  'system_prompt',
  'systemPrompt',
];

/** 允许作为 trace 形状的最小子集（页面持有的 TraceData 兼容此契约） */
export type MarkdownTrace = {
  id: string;
  name?: string | null;
  timestamp?: string | null;
  latency?: number | null;
  metadata?: Record<string, unknown> | null | unknown;
  observations?: Array<Observation | string> | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/** 过滤出真正的 Observation 对象（兼容后端混入的字符串条目） */
function toObservations(
  raw: MarkdownTrace['observations'],
): Observation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is Observation => typeof o === 'object' && o !== null && 'id' in o,
  );
}

function formatLatency(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return 'N/A';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatStartTime(iso: string | null | undefined): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toISOString();
}

function formatTokens(total: number | null | undefined): string {
  if (total == null) return 'N/A';
  return String(total);
}

function computeSpanLatency(span: Observation): number | null {
  if (!span.endTime) return null;
  const start = new Date(span.startTime).getTime();
  const end = new Date(span.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

function computeSpanTokens(span: Observation): number | null {
  const u = asRecord(span.usage);
  if (!u) return null;
  const candidates = ['totalTokens', 'total_tokens', 'total'];
  for (const k of candidates) {
    const v = u[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  const prompt = typeof u.promptTokens === 'number' ? u.promptTokens : 0;
  const completion = typeof u.completionTokens === 'number' ? u.completionTokens : 0;
  if (prompt === 0 && completion === 0) return null;
  return prompt + completion;
}

function readStringAttr(
  attrs: Record<string, unknown> | null,
  keys: string[],
): string | null {
  if (!attrs) return null;
  for (const k of keys) {
    const v = attrs[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return null;
}

/** 从 span 的 input 数组里抽取 system / developer role 的文本 */
function extractSystemFromMessages(input: unknown): string | null {
  if (!Array.isArray(input)) return null;
  const sysMsg = input.find(
    (m) =>
      m &&
      typeof m === 'object' &&
      ((m as Record<string, unknown>).role === 'system' ||
        (m as Record<string, unknown>).role === 'developer'),
  );
  if (!sysMsg) return null;
  const content = (sysMsg as Record<string, unknown>).content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .filter((p) => p && typeof p === 'object')
      .map((p) => {
        const part = p as Record<string, unknown>;
        if (part.type === 'text' && typeof part.content === 'string') {
          return part.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
    return text || null;
  }
  return null;
}

/**
 * 提取 system prompt，来源优先级：
 *  1) span.metadata.attributes 中的 GenAI 约定字段
 *  2) span.systemPrompt / span.system_prompt 顶层字段
 *  3) span.input 数组里的 system/developer role 消息
 */
export function extractSystemPrompt(span: unknown): string | null {
  const s = asRecord(span);
  if (!s) return null;

  const metadata = asRecord(s.metadata);
  const attributes = asRecord(metadata?.attributes);

  const fromAttrs = readStringAttr(attributes, GENAI_PROMPT_KEYS);
  if (fromAttrs) return fromAttrs;

  const topLevel =
    (typeof s.systemPrompt === 'string' && s.systemPrompt) ||
    (typeof s.system_prompt === 'string' && s.system_prompt) ||
    null;
  if (topLevel) return topLevel;

  return extractSystemFromMessages(s.input);
}

/** 把 RoleBlock[] 拼接为扁平字符串；reasoning 单独成段以便区分 */
function flattenBlocks(blocks: RoleBlock[]): string {
  if (blocks.length === 0) return '';
  return blocks
    .map((b) => {
      const header = b.partType !== 'text' ? `[${b.partType}]\n` : '';
      return `${header}${b.content}`.trim();
    })
    .filter((s) => s.length > 0)
    .join('\n\n');
}

/** 把任意 payload 渲染为字符串：可格式化的消息数组走 extractContent，否则 JSON.stringify */
function renderPayload(payload: unknown): string | null {
  if (payload == null) return null;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (hasFormattableContent(payload)) {
    const flat = flattenBlocks(extractContent(payload));
    return flat.length > 0 ? flat : null;
  }
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

/**
 * 提取"用户输入"：优先非 system 角色的消息数组，缺失时退回完整 input 的渲染。
 * 不臆造数据；输入为空时返回 null。
 */
export function extractInputContent(span: unknown): string | null {
  const s = asRecord(span);
  if (!s) return null;
  const input = s.input;

  if (Array.isArray(input)) {
    const nonSystem = input.filter((m) => {
      if (!m || typeof m !== 'object') return false;
      const role = (m as Record<string, unknown>).role;
      return role !== 'system' && role !== 'developer';
    });
    if (nonSystem.length > 0) {
      const rendered = renderPayload(nonSystem);
      if (rendered) return rendered;
    }
  }

  return renderPayload(input);
}

/** 提取模型/工具输出；无内容时返回 null，由调用方决定是否补 *No output recorded.* */
export function extractOutputContent(span: unknown): string | null {
  const s = asRecord(span);
  if (!s) return null;
  return renderPayload(s.output);
}

/**
 * 将整个 trace 序列化为 LLM 友好的 Markdown。
 * 文档结构：
 *   # Trace Analysis: <name>
 *   ## Global Metadata
 *   ## Trace Spans (Chronological Order)
 *     ### <n>. [<type>] <name>
 *       <input>...</input>
 *         <system_prompt>...</system_prompt>   (可选)
 *         <user_input>...</user_input>         (可选)
 *       <output>...</output>                   (可选；无内容回退 *No output recorded.*)
 */
export function generateMarkdownTrace(trace: MarkdownTrace): string {
  const observations = toObservations(trace?.observations);
  const sortedObs = [...observations].sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  const lines: string[] = [];
  lines.push(`# Trace Analysis: ${trace?.name?.trim() || 'Unknown'}`);
  lines.push('');

  // 1. Global Metadata
  const tokenAgg = aggregateTokenUsage(sortedObs);
  lines.push('## Global Metadata');
  lines.push(`- **Trace ID**: ${trace?.id ?? 'N/A'}`);
  lines.push(`- **Latency**: ${formatLatency(trace?.latency)}`);
  lines.push(`- **Total Tokens**: ${formatTokens(tokenAgg?.total ?? null)}`);
  lines.push(`- **Start Time**: ${formatStartTime(trace?.timestamp)}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // 2. Spans
  lines.push('## Trace Spans (Chronological Order)');
  lines.push('');

  if (sortedObs.length === 0) {
    lines.push('*No observations found.*');
    return lines.join('\n');
  }

  sortedObs.forEach((span, index) => {
    const heading = `### ${index + 1}. [${span.type || 'span'}] ${span.name?.trim() || 'Unnamed'}`;
    lines.push(heading);
    lines.push(`- **Latency**: ${formatLatency(computeSpanLatency(span))}`);
    const tokens = computeSpanTokens(span);
    if (tokens != null) {
      lines.push(`- **Tokens**: ${tokens}`);
    }
    lines.push('');

    // <input>
    lines.push('<input>');
    const systemPrompt = extractSystemPrompt(span);
    if (systemPrompt) {
      lines.push(`<system_prompt>\n${systemPrompt}\n</system_prompt>`);
    }
    const userInput = extractInputContent(span);
    if (userInput) {
      lines.push(`<user_input>\n${userInput}\n</user_input>`);
    }
    lines.push('</input>');
    lines.push('');

    // <output>
    lines.push('<output>');
    const outputContent = extractOutputContent(span);
    lines.push(outputContent ?? '*No output recorded.*');
    lines.push('</output>');
    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
}
