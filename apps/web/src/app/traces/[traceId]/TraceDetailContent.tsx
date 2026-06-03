'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import type { ProjectConfig } from '@llm-observability/shared/schemas/project';
import type { Observation } from '@llm-observability/shared/schemas/project';
import ViewModeToggle, { type ViewMode } from './components/ViewModeToggle';
import ObservationsSplitView, { type TraceNodeData } from './components/ObservationsSplitView';
import { MetadataBlock } from './components/ContentBlock';
import { aggregateTokenUsage } from './lib/usage';

// ===== Types =====

type TraceData = {
  id: string;
  name: string | null;
  userId: string | null;
  sessionId: string | null;
  input: Record<string, unknown>[] | string | null;
  output: Record<string, unknown>[] | string | null;
  metadata: Record<string, unknown> | null;
  timestamp: string;
  release: string | null;
  version: string | null;
  createdAt: string;
  updatedAt: string;
  observations: Observation[] | string[];
  scores: { id: string; name: string; value: number; source?: string | null; comment?: string | null }[];
  totalCost: number;
  latency: number;
};

// ===== Helpers =====

function formatLatency(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${min}`;
}

/** 从 observations 数组中提取真正的 Observation 对象 */
function extractObservations(raw: Observation[] | string[]): Observation[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is Observation => typeof o === 'object' && o !== null && 'id' in o);
}

// ===== Main Component =====

export default function TraceDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const params = useParams<{ traceId: string }>();
  const projectId = searchParams.get('projectId');
  const traceId = params.traceId;

  const [project, setProject] = useState<ProjectConfig | null>(null);
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('formatted');

  // 获取项目信息
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => {});
  }, [projectId]);

  // 获取 trace 详情
  useEffect(() => {
    if (!projectId || !traceId) return;
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ projectId, traceId });
    fetch(`/api/langfuse/traces?${p.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setTrace(data);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load trace');
      })
      .finally(() => setLoading(false));
  }, [projectId, traceId]);

  // 返回列表
  const handleBack = () => {
    if (projectId) {
      router.push(`/traces?projectId=${projectId}`);
    } else {
      router.push('/traces');
    }
  };

  // 构建统一节点列表：根 Trace + 所有 Observations
  const nodes: TraceNodeData[] = useMemo(() => {
    if (!trace) return [];

    const result: TraceNodeData[] = [];

    // 根 Trace 节点（排在第一个）
    result.push({
      id: `trace-${trace.id}`,
      name: trace.name || 'Root Trace',
      type: 'TRACE',
      input: trace.input,
      output: trace.output,
      metadata: trace.metadata,
      latency: trace.latency,
      startTime: trace.timestamp,
    });

    // Observation 节点
    const observations = extractObservations(trace.observations);
    for (const obs of observations) {
      const latency = obs.endTime
        ? (new Date(obs.endTime).getTime() - new Date(obs.startTime).getTime()) / 1000
        : null;
      result.push({
        id: obs.id,
        name: obs.name || obs.type,
        type: obs.type,
        input: obs.input,
        output: obs.output,
        metadata: obs.metadata,
        latency,
        model: obs.model,
        usage: obs.usage,
        statusMessage: obs.statusMessage,
        parentObservationId: obs.parentObservationId,
        startTime: obs.startTime,
      });
    }

    return result;
  }, [trace]);

  // 汇总所有 observations 的 token 消耗
  const tokenUsage = useMemo(() => {
    if (!trace) return null;
    return aggregateTokenUsage(extractObservations(trace.observations));
  }, [trace]);

  if (loading) {
    return (
      <div className="w-full mx-auto px-md">
        <div className="flex items-center justify-center py-xl">
          <span className="material-symbols-outlined text-[24px] text-on-surface-variant animate-spin mr-sm">progress_activity</span>
          <p className="font-body-md text-body-md text-on-surface-variant">Loading trace details...</p>
        </div>
      </div>
    );
  }

  if (error || !trace) {
    return (
      <div className="w-full mx-auto px-md">
        <div className="bg-error-container/10 border border-error/30 rounded-lg p-md mb-md flex items-center gap-sm">
          <span className="material-symbols-outlined text-error text-[20px]">error</span>
          <p className="font-body-sm text-body-sm text-error">{error || 'Trace not found'}</p>
        </div>
        <button onClick={handleBack} className="inline-flex items-center gap-xs text-primary font-body-sm hover:underline">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Traces
        </button>
      </div>
    );
  }

  const observations = extractObservations(trace.observations);

  return (
    <div className="w-full mx-auto px-md">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant mb-sm">
        <Link href="/" className="hover:text-primary transition-colors">Projects</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href={`/traces?projectId=${projectId}`} className="hover:text-primary transition-colors">
          {project?.name ?? 'Traces'}
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-on-surface font-medium">{trace.name || trace.id}</span>
      </div>

      {/* Header + View Mode Toggle */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{trace.name || 'Untitled Trace'}</h1>
          <p className="text-xs font-mono text-gray-500 mt-0.5">{trace.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <button
            onClick={handleBack}
            className="flex items-center gap-1 bg-white border border-gray-200 text-gray-600 text-sm py-1 px-3 rounded-md hover:bg-gray-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm">
          <span className="material-symbols-outlined text-[16px] text-gray-500">schedule</span>
          <span className="text-gray-500 font-medium">Latency:</span>
          <span className={`font-mono font-medium ${trace.latency > 30 ? 'text-red-500' : 'text-gray-800'}`}>{formatLatency(trace.latency)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm">
          <span className="material-symbols-outlined text-[16px] text-gray-500">visibility</span>
          <span className="text-gray-500 font-medium">Observations:</span>
          <span className="font-medium text-gray-800">{observations.length}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm">
          <span className="material-symbols-outlined text-[16px] text-gray-500">calendar_today</span>
          <span className="text-gray-500 font-medium">Created:</span>
          <span className="font-medium text-gray-800">{formatDate(trace.createdAt)}</span>
        </div>
        {trace.sessionId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm">
            <span className="material-symbols-outlined text-[16px] text-gray-500 shrink-0">fingerprint</span>
            <span className="text-gray-500 font-medium shrink-0">Session:</span>
            <span className="font-mono font-medium text-gray-800" title={trace.sessionId}>{trace.sessionId}</span>
          </div>
        )}
        {tokenUsage && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm" title="所有 observations 的 token 消耗汇总">
            <span className="material-symbols-outlined text-[16px] text-gray-500 shrink-0">numbers</span>
            <span className="text-gray-500 font-medium shrink-0">Tokens:</span>
            <span className="font-mono font-medium text-gray-800">{tokenUsage.total}</span>
            <span className="font-mono text-xs text-gray-500">↑{tokenUsage.input} ↓{tokenUsage.output}</span>
          </div>
        )}
        {trace.userId && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-sm max-w-[280px]">
            <span className="material-symbols-outlined text-[16px] text-gray-500 shrink-0">person</span>
            <span className="text-gray-500 font-medium shrink-0">User:</span>
            <span className="font-mono font-medium text-gray-800 truncate" title={trace.userId}>{trace.userId}</span>
          </div>
        )}
      </div>

      {/* Scores */}
      {trace.scores?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Scores</h3>
          <div className="flex flex-wrap gap-2">
            {trace.scores.map((s) => (
              <span
                key={s.id}
                className={`px-2 py-1 rounded-md text-sm ${s.value >= 0.8 ? 'bg-green-50 text-green-700 border border-green-200' : s.value >= 0.5 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
              >
                {s.name}: {s.value.toFixed(3)}
                {s.comment && <span className="ml-1 opacity-70">({s.comment})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 核心区域：Master-Detail 分栏视图 */}
      {/* 根 Trace 的 Input/Output + 所有 Observations 统一在分栏中展示 */}
      <ObservationsSplitView nodes={nodes} viewMode={viewMode} />

      {/* Trace 级别 Metadata（独立于节点详情） */}
      {trace.metadata && typeof trace.metadata === 'object' && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Trace Metadata</h3>
          <MetadataBlock data={trace.metadata as Record<string, unknown>} />
        </div>
      )}
    </div>
  );
}
