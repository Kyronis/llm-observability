/**
 * Token 使用量提取与聚合
 * 兼容 Langfuse 公开 API 的多代字段名：
 *  - v2 公开 API:        usage = { promptTokens, completionTokens, totalTokens }
 *  - v3 deprecated:      usage = { input, output, total }
 *  - v3 推荐（usageDetails）: Record<string, number>，常见 key 含 input/output/total、input_tokens/output_tokens/total_tokens、prompt_tokens/completion_tokens
 */

export type UsageParts = { input: number; output: number; total: number } | null;

const INPUT_KEYS = ['input', 'input_tokens', 'prompt_tokens', 'promptTokens'];
const OUTPUT_KEYS = ['output', 'output_tokens', 'completion_tokens', 'completionTokens'];
const TOTAL_KEYS = ['total', 'total_tokens', 'totalTokens'];

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function readNumber(rec: Record<string, unknown> | null, keys: string[]): number | null {
  if (!rec) return null;
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * 从单个 observation 中提取输入/输出 token。
 * 返回 null 表示该 observation 没有可用 token 数据。
 */
export function extractUsageParts(obs: unknown): UsageParts {
  const o = asRecord(obs);
  if (!o) return null;
  const usageDetails = asRecord(o.usageDetails);
  const usage = asRecord(o.usage);
  const input = readNumber(usageDetails, INPUT_KEYS) ?? readNumber(usage, INPUT_KEYS);
  const output = readNumber(usageDetails, OUTPUT_KEYS) ?? readNumber(usage, OUTPUT_KEYS);
  const total = readNumber(usageDetails, TOTAL_KEYS) ?? readNumber(usage, TOTAL_KEYS);
  if (input == null && output == null && total == null) return null;
  return { input: input ?? 0, output: output ?? 0, total: total ?? 0 };
}

/** 聚合一组 observations 的 token 消耗；全部无数据时返回 null。 */
export function aggregateTokenUsage(observations: unknown[]): UsageParts {
  let input = 0;
  let output = 0;
  let total = 0;
  let hasAny = false;
  for (const obs of observations) {
    const parts = extractUsageParts(obs);
    if (!parts) continue;
    input += parts.input;
    output += parts.output;
    total += parts.total;
    hasAny = true;
  }
  if (!hasAny) return null;
  return { input, output, total };
}

/** 把 token 数格式化为 `Tokens:2871 ↑834 ↓2037` 风格的 pill 文本；无数据时返回 null。
 * 入参可以是 observation（含 usage/usageDetails 字段），也可以直接是 usage 对象本身。 */
export function formatUsagePill(obsOrUsage: unknown): string | null {
  const o = asRecord(obsOrUsage);
  if (!o) return null;
  // 形如 observation：含 usageDetails 或 usage 字段时走完整提取路径
  const parts =
    o.usageDetails !== undefined || o.usage !== undefined
      ? extractUsageParts(o)
      : (() => {
          const input = readNumber(o, INPUT_KEYS);
          const output = readNumber(o, OUTPUT_KEYS);
          const total = readNumber(o, TOTAL_KEYS);
          if (input == null && output == null && total == null) return null;
          return { input: input ?? 0, output: output ?? 0, total: total ?? 0 };
        })();
  if (!parts) return null;
  const { input, output, total } = parts;
  if (input === 0 && output === 0) {
    if (total === 0) return null;
    return `Tokens:${total}`;
  }
  return [`Tokens:${total}`, `↑${input}`, `↓${output}`].join(' ');
}
