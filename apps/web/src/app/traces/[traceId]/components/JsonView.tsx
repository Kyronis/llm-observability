import type { ReactNode } from 'react';

const TOKEN_REGEX = /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],])/g;

/** 高亮一行 JSON 内容。保留缩进由调用方处理。 */
function tokenizeLine(content: string, lineIdx: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let tokenIdx = 0;
  const regex = new RegExp(TOKEN_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    if (m.index > lastIndex) {
      nodes.push(content.slice(lastIndex, m.index));
    }
    const key = `${lineIdx}-${tokenIdx++}`;
    if (m[1]) {
      const str = m[1].replace(/\s*:\s*$/, '');
      const trailing = m[1].slice(str.length);
      nodes.push(<span key={key} className="text-purple-700">{str}</span>);
      if (trailing) {
        nodes.push(<span key={`${key}-c`} className="text-gray-500">{trailing}</span>);
      }
    } else if (m[2]) {
      nodes.push(<span key={key} className="text-emerald-700">{m[2]}</span>);
    } else if (m[3]) {
      nodes.push(<span key={key} className="text-orange-600">{m[3]}</span>);
    } else if (m[4]) {
      nodes.push(<span key={key} className="text-blue-600">{m[4]}</span>);
    } else if (m[5]) {
      nodes.push(<span key={key} className="text-gray-500">{m[5]}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < content.length) {
    nodes.push(content.slice(lastIndex));
  }
  return nodes;
}

/**
 * 轻量 JSON 语法高亮视图（无外部依赖）。
 * 输入是已 parse 的 JS 值（对象/数组/标量均可）。
 * 配色：key 紫、string 绿、number 蓝、boolean/null 橙、标点 灰。
 */
export default function JsonView({ value }: { value: unknown }) {
  const json = JSON.stringify(value, null, 2);
  const lines = json.split('\n');
  return (
    <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words break-word max-h-[300px] overflow-y-auto">
      {lines.map((line, i) => {
        const indentMatch = line.match(/^(\s*)(.*)$/);
        const indent = indentMatch?.[1] ?? '';
        const content = indentMatch?.[2] ?? '';
        return (
          <div key={i}>
            {indent}
            {tokenizeLine(content, i)}
          </div>
        );
      })}
    </pre>
  );
}

/** 尝试将字符串解析为 JSON；解析失败或结果非对象/数组时返回 null */
export function tryParseJsonString(s: string): unknown | null {
  if (!isJsonLikeString(s)) return null;
  try {
    return JSON.parse(unescape(s));
  } catch {
    return null;
  }
}

const JSON_OBJECT_RE = /^\s*\{[\s\S]*\}\s*$/;
const JSON_ARRAY_RE = /^\s*\[[\s\S]*\]\s*$/;

/** 粗略判断字符串是否"看起来像" JSON 对象/数组（首尾是 {} 或 []） */
function isJsonLikeString(s: string): boolean {
  return JSON_OBJECT_RE.test(s) || JSON_ARRAY_RE.test(s);
}

/**
 * 深度递归清洗：把对象/数组里"看起来像 JSON 的字符串值"全部解析为真正的对象/数组。
 * 用于 attributes 这类可能存在双重编码的字段，避免 UI 渲染出 `"{\\"a\\": 1}"` 这种转义长串。
 */
export function deepParseJson<T>(value: T): T {
  if (typeof value === 'string') {
    const parsed = tryParseJsonString(value);
    if (parsed !== null) return deepParseJson(parsed as T);
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepParseJson(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = deepParseJson(v);
    }
    return result as unknown as T;
  }
  return value;
}
