'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ViewMode } from './ViewModeToggle';
import { extractContent, getRoleLabel, getRoleTagStyle, getPartTypeLabel, getPartTypeStyle, getPartTypeTagStyle, hasFormattableContent } from '../lib/format';
import { MetadataBlock } from './ContentBlock';
import type { Observation } from '@llm-observability/shared/schemas/project';

// ===== 统一节点类型 =====

export type TraceNodeData = {
  id: string;
  name: string;
  type: 'TRACE' | 'SPAN' | 'GENERATION' | 'EVENT';
  input?: unknown;
  output?: unknown;
  metadata?: unknown;
  latency: number | null; // 秒
  model?: string | null;
  usage?: { promptTokens?: number | null; completionTokens?: number | null; totalTokens?: number | null } | null;
  statusMessage?: string | null;
  parentObservationId?: string | null;
  /** 开始时间，用于排序 */
  startTime: string;
};

// ===== 辅助函数 =====

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function isSlowCall(seconds: number | null): boolean {
  return seconds != null && seconds > 30;
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'TRACE': return 'link';
    case 'GENERATION': return 'auto_awesome';
    case 'SPAN': return 'merge_type';
    case 'EVENT': return 'fiber_manual_record';
    default: return 'circle';
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'TRACE': return 'text-emerald-600';
    case 'GENERATION': return 'text-purple-600';
    case 'SPAN': return 'text-blue-600';
    case 'EVENT': return 'text-gray-500';
    default: return 'text-gray-400';
  }
}

function formatUsageCompact(usage: TraceNodeData['usage']): string | null {
  if (!usage) return null;
  // 兼容两种字段名：promptTokens/input, completionTokens/output
  const input = usage.promptTokens ?? (usage as Record<string, unknown>).input as number | null ?? null;
  const output = usage.completionTokens ?? (usage as Record<string, unknown>).output as number | null ?? null;
  const total = usage.totalTokens ?? (usage as Record<string, unknown>).total as number | null ?? null;
  if (input == null && output == null && total == null) return null;
  const parts: string[] = [];
  if (input != null) parts.push(`in:${input.toLocaleString()}`);
  if (output != null) parts.push(`out:${output.toLocaleString()}`);
  if (total != null && input == null && output == null) parts.push(`total:${total.toLocaleString()}`);
  return parts.join(' ');
}

// ===== 右侧面板内容渲染 =====

function DetailContent({ data, viewMode, label }: { data: unknown; viewMode: ViewMode; label: string }) {
  if (data == null) return null;

  const rawJson = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  if (viewMode === 'json' || !hasFormattableContent(data)) {
    return (
      <div className="bg-gray-50 p-3 rounded-md">
        <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
        <pre className="font-mono text-xs text-gray-800 whitespace-pre-wrap break-words max-h-[240px] overflow-y-auto">
          {rawJson}
        </pre>
      </div>
    );
  }

  const blocks = extractContent(data);
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1.5">{label}</p>
      <div className="space-y-2">
        {blocks.map((block, idx) => (
          <div key={idx} className={`border rounded-md p-3 text-sm ${getPartTypeStyle(block.partType)}`}>
            {/* 标签行 */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPartTypeTagStyle(block.partType)}`}>
                {getPartTypeLabel(block.partType)}
              </span>
              {block.role && block.role !== 'text' && block.role !== 'unknown' && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleTagStyle(block.role)}`}>
                  {getRoleLabel(block.role)}
                </span>
              )}
              {block.toolCall && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-white border border-purple-300 text-purple-800">
                  {block.toolCall.name}
                </span>
              )}
            </div>
            <div
              className={`prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 overflow-x-auto max-h-[360px] overflow-y-auto${block.partType === 'tool_call' ? ' text-base' : ''}`}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 主组件 =====

interface ObservationsSplitViewProps {
  nodes: TraceNodeData[];
  viewMode: ViewMode;
}

export default function ObservationsSplitView({ nodes, viewMode }: ObservationsSplitViewProps) {
  const [selectedNode, setSelectedNode] = useState<TraceNodeData | null>(nodes[0] ?? null);

  if (nodes.length === 0) return null;

  // 构建树结构用于左侧缩进
  const childMap = new Map<string, TraceNodeData[]>();
  const roots: TraceNodeData[] = [];

  for (const node of nodes) {
    if (node.parentObservationId) {
      const children = childMap.get(node.parentObservationId) ?? [];
      children.push(node);
      childMap.set(node.parentObservationId, children);
    } else {
      roots.push(node);
    }
  }

  // 子节点按 startTime 升序排列
  for (const children of childMap.values()) {
    children.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }
  // 根节点也按 startTime 升序
  roots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // 扁平化渲染列表（保持树状缩进）
  const flatList: { node: TraceNodeData; depth: number }[] = [];
  function flatten(nodeIds: TraceNodeData[], depth: number) {
    for (const n of nodeIds) {
      flatList.push({ node: n, depth });
      const children = childMap.get(n.id);
      if (children) flatten(children, depth + 1);
    }
  }
  flatten(roots, 0);

  // 渲染左侧列表项
  const renderListItem = ({ node, depth }: { node: TraceNodeData; depth: number }) => {
    const isSelected = selectedNode?.id === node.id;
    const icon = getTypeIcon(node.type);
    const color = getTypeColor(node.type);
    const slow = isSlowCall(node.latency);
    const duration = formatDuration(node.latency);

    return (
      <button
        key={node.id}
        onClick={() => setSelectedNode(node)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 border-b border-gray-200 text-left transition-colors ${
          isSelected
            ? 'bg-blue-50 border-l-4 border-l-blue-500'
            : 'hover:bg-gray-100 border-l-4 border-l-transparent'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <span className={`material-symbols-outlined text-[16px] shrink-0 ${color}`}>{icon}</span>
        <span className="font-medium text-sm text-gray-900 truncate flex-1 min-w-0">
          {node.name}
        </span>
        <span className={`text-xs font-mono shrink-0 ${slow ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
          {duration}
        </span>
      </button>
    );
  };

  // 渲染右侧详情
  const renderDetail = () => {
    if (!selectedNode) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          Select a node to view details
        </div>
      );
    }

    const node = selectedNode;
    const icon = getTypeIcon(node.type);
    const color = getTypeColor(node.type);
    const slow = isSlowCall(node.latency);
    const duration = formatDuration(node.latency);
    const usageInfo = formatUsageCompact(node.usage);

    // 统一的 pill 标签样式
    const pill = 'px-2 py-0.5 rounded text-xs font-medium';

    return (
      <div className="p-4 space-y-4">
        {/* Node Header */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`material-symbols-outlined text-[20px] ${color}`}>{icon}</span>
          <h3 className="font-semibold text-gray-900 text-base">{node.name}</h3>
          <span className={`${pill} bg-gray-100 text-gray-600`}>
            {node.type}
          </span>
          {node.model && (
            <span className={`${pill} bg-indigo-50 text-indigo-700 border border-indigo-200`}>
              {node.model}
            </span>
          )}
          <span className={`${pill} font-mono ${slow ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-100 text-gray-600'}`}>
            {duration}
          </span>
          {usageInfo && (
            <span className={`${pill} font-mono bg-emerald-50 text-emerald-700 border border-emerald-200`}>
              {usageInfo}
            </span>
          )}
          {node.statusMessage && (
            <span className={`${pill} bg-red-50 text-red-600`}>
              {node.statusMessage}
            </span>
          )}
        </div>

        {/* Input */}
        {node.input != null && (
          <DetailContent data={node.input} viewMode={viewMode} label="Input" />
        )}

        {/* Output */}
        {node.output != null && (
          <DetailContent data={node.output} viewMode={viewMode} label="Output" />
        )}

        {/* Metadata */}
        {node.metadata != null && typeof node.metadata === 'object' && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">Metadata</p>
            <MetadataBlock data={node.metadata as Record<string, unknown>} />
          </div>
        )}

        {/* 无内容提示 */}
        {node.input == null && node.output == null && (node.metadata == null || typeof node.metadata !== 'object') && (
          <p className="text-sm text-gray-400 italic py-4 text-center">No input/output data for this node</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white" style={{ minHeight: '600px' }}>
      {/* 左侧：节点列表 */}
      <div className="w-1/3 min-w-[280px] max-w-[400px] border-r border-gray-200 flex flex-col bg-gray-50 overflow-y-auto">
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Observations</h3>
        </div>
        {flatList.map((item) => renderListItem(item))}
      </div>

      {/* 右侧：详情面板 */}
      <div className="w-2/3 flex-1 flex flex-col bg-white overflow-y-auto">
        {renderDetail()}
      </div>
    </div>
  );
}
