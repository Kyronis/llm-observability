/**
 * 数据解析与格式化工具
 * 用于从 LLM 消息结构中提取文本内容，按 part 类型独立分块
 */

export type RoleBlock = {
  /** part 的 type 字段：text / reasoning / tool_call 等，用于区分样式 */
  partType: string;
  /** 消息的 role：user / assistant / system 等 */
  role: string;
  /** 提取出的文本内容 */
  content: string;
  /** tool_call 附加信息 */
  toolCall?: {
    id?: string;
    name: string;
    arguments: string;
  };
};

/**
 * 从 LLM 消息数组中提取按 part 类型独立分块的文本内容
 * 每个 part（text / reasoning / tool_call）返回独立的 RoleBlock
 */
export function extractContent(payload: unknown): RoleBlock[] {
  if (payload == null) return [];

  // 字符串直接返回
  if (typeof payload === 'string') {
    return [{ partType: 'text', role: 'text', content: payload }];
  }

  // 数组格式 - 标准 LLM 消息结构
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => extractFromMessage(item)).filter((b) => b.content.length > 0);
  }

  // 单个对象
  if (typeof payload === 'object') {
    const blocks = extractFromMessage(payload as Record<string, unknown>);
    return blocks.filter((b) => b.content.length > 0);
  }

  return [];
}

function extractFromMessage(msg: Record<string, unknown>): RoleBlock[] {
  const role = String(msg.role ?? 'unknown');
  const results: RoleBlock[] = [];

  // 优先处理 parts 数组格式 - 每个 part 独立返回
  if (Array.isArray(msg.parts)) {
    for (const part of msg.parts) {
      if (!part || typeof part !== 'object') continue;
      const p = part as Record<string, unknown>;

      if (p.type === 'text' && typeof p.content === 'string') {
        results.push({ partType: 'text', role, content: p.content });
      } else if (p.type === 'reasoning' && p.content != null) {
        const text = typeof p.content === 'string' ? p.content : JSON.stringify(p.content, null, 2);
        results.push({ partType: 'reasoning', role, content: text });
      } else if (p.type === 'tool_call') {
        const name = typeof p.name === 'string' ? p.name : 'unknown';
        const args = p.arguments != null ? JSON.stringify(p.arguments, null, 2) : '{}';
        const id = typeof p.id === 'string' ? p.id : undefined;
        results.push({
          partType: 'tool_call',
          role,
          content: `**${name}**\n\`\`\`json\n${args}\n\`\`\``,
          toolCall: { id, name, arguments: args },
        });
      }
    }
    if (results.length > 0) return results;
  }

  // 处理 content 字段
  if (msg.content != null) {
    if (typeof msg.content === 'string') {
      return [{ partType: 'text', role, content: msg.content }];
    }
    if (Array.isArray(msg.content)) {
      // content 可能是 parts 数组
      for (const part of msg.content) {
        if (typeof part === 'string') {
          results.push({ partType: 'text', role, content: part });
        } else if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>;
          if (p.type === 'text' && typeof p.content === 'string') {
            results.push({ partType: 'text', role, content: p.content });
          } else if (p.type === 'reasoning' && p.content != null) {
            const text = typeof p.content === 'string' ? p.content : JSON.stringify(p.content, null, 2);
            results.push({ partType: 'reasoning', role, content: text });
          } else if (p.type === 'tool_call') {
            const name = typeof p.name === 'string' ? p.name : 'unknown';
            const args = p.arguments != null ? JSON.stringify(p.arguments, null, 2) : '{}';
            const id = typeof p.id === 'string' ? p.id : undefined;
            results.push({
              partType: 'tool_call',
              role,
              content: `**${name}**\n\`\`\`json\n${args}\n\`\`\``,
              toolCall: { id, name, arguments: args },
            });
          }
        }
      }
      if (results.length > 0) return results;
    }
  }

  // 处理 tool_calls 数组（OpenAI 格式）
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (typeof tc !== 'object' || tc == null) continue;
      const t = tc as Record<string, unknown>;
      const fn = t.function as Record<string, unknown> | null;
      if (fn && typeof fn.name === 'string') {
        const name = fn.name;
        const args = typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments ?? {}, null, 2);
        const id = typeof t.id === 'string' ? t.id : undefined;
        results.push({
          partType: 'tool_call',
          role,
          content: `**${name}**\n\`\`\`json\n${args}\n\`\`\``,
          toolCall: { id, name, arguments: args },
        });
      }
    }
    if (results.length > 0) return results;
  }

  // 兜底：序列化整个对象
  return [{ partType: 'fallback', role, content: JSON.stringify(msg, null, 2) }];
}

/**
 * 判断 payload 是否包含可格式化的文本内容（非纯 JSON 对象）
 */
export function hasFormattableContent(payload: unknown): boolean {
  if (payload == null) return false;
  if (typeof payload === 'string') return true;
  if (Array.isArray(payload)) {
    return payload.some(
      (item) =>
        item &&
        typeof item === 'object' &&
        (Array.isArray((item as Record<string, unknown>).parts) ||
          typeof (item as Record<string, unknown>).content === 'string' ||
          Array.isArray((item as Record<string, unknown>).tool_calls)),
    );
  }
  return false;
}

/**
 * part 类型对应的显示标签
 */
export function getPartTypeLabel(partType: string): string {
  const map: Record<string, string> = {
    text: 'Text',
    reasoning: 'Reasoning',
    tool_call: 'Tool Call',
    fallback: 'Raw',
  };
  return map[partType] || partType;
}

/**
 * part 类型对应的颜色样式
 */
export function getPartTypeStyle(partType: string): string {
  switch (partType) {
    case 'reasoning':
      return 'bg-blue-50 text-blue-900 border-blue-200';
    case 'tool_call':
      return 'bg-purple-50 text-purple-900 border-purple-200';
    case 'text':
      return 'bg-white text-gray-900 border-gray-200';
    case 'fallback':
      return 'bg-gray-50 text-gray-600 border-gray-200';
    default:
      return 'bg-gray-50 text-gray-900 border-gray-200';
  }
}

/**
 * part 类型对应的标签颜色
 */
export function getPartTypeTagStyle(partType: string): string {
  switch (partType) {
    case 'reasoning':
      return 'bg-amber-100 text-amber-700';
    case 'tool_call':
      return 'bg-purple-100 text-purple-700';
    case 'text':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

/**
 * 角色显示名称映射
 */
export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    user: 'User',
    assistant: 'Assistant',
    system: 'System',
    tool: 'Tool',
    function: 'Function',
  };
  return map[role.toLowerCase()] || role;
}

/**
 * 角色对应的颜色样式（用于角色标签）
 */
export function getRoleTagStyle(role: string): string {
  switch (role.toLowerCase()) {
    case 'user':
      return 'bg-blue-100 text-blue-700';
    case 'assistant':
      return 'bg-emerald-100 text-emerald-700';
    case 'system':
      return 'bg-gray-100 text-gray-600';
    case 'tool':
    case 'function':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}
