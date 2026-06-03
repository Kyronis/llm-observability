'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ViewMode } from './ViewModeToggle';
import { extractContent, getRoleLabel, getRoleTagStyle, getPartTypeLabel, getPartTypeStyle, getPartTypeTagStyle, hasFormattableContent } from '../lib/format';
import JsonView, { deepParseJson } from './JsonView';

/** 内容区块渲染：根据 viewMode 条件渲染 */
export default function ContentBlock({ data, viewMode }: { data: unknown; viewMode: ViewMode }) {
  if (data == null) return null;

  // JSON 模式：直接显示原始 JSON
  if (viewMode === 'json') {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return (
      <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm font-mono overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words break-word">
        {jsonStr}
      </pre>
    );
  }

  // formatted 模式：提取文本 → 按 partType 独立分块渲染
  const blocks = extractContent(data);
  if (blocks.length === 0 || !hasFormattableContent(data)) {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    return (
      <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm font-mono overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words break-word">
        {jsonStr}
      </pre>
    );
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <div key={i} className={`border rounded-md p-3 text-sm ${getPartTypeStyle(block.partType)}`}>
          {/* 标签行：part type + role */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPartTypeTagStyle(block.partType)}`}>
              {getPartTypeLabel(block.partType)}
            </span>
            {block.role && block.role !== 'text' && block.role !== 'unknown' && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleTagStyle(block.role)}`}>
                {getRoleLabel(block.role)}
              </span>
            )}
            {/* tool_call 特殊标签：函数名 */}
            {block.toolCall && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-white border border-purple-300 text-purple-800">
                {block.toolCall.name}
              </span>
            )}
          </div>
          <div
            className={`prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 overflow-x-auto max-h-[450px] overflow-y-auto${block.partType === 'tool_call' ? ' text-base' : ''}`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {block.content}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Metadata 渲染：键值对表格，JSON 字符串/对象走语法高亮视图 */
export function MetadataBlock({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, val]) => (
            <tr key={key} className="border-b border-gray-200 last:border-b-0 align-top">
              <td className="px-3 py-1.5 font-medium text-gray-600 w-1/4 shrink-0">{key}</td>
              <td className="px-3 py-1.5 text-gray-800 font-mono text-xs">{renderMetadataValue(val)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderMetadataValue(val: unknown) {
  if (val == null) return '—';
  // 先做深度递归清洗：把对象/数组里"看起来像 JSON 的字符串值"全部解析为真正的对象/数组
  const cleaned = deepParseJson(val);
  if (typeof cleaned === 'string') return cleaned;
  if (typeof cleaned === 'object') {
    return <JsonView value={cleaned} />;
  }
  return String(cleaned);
}
