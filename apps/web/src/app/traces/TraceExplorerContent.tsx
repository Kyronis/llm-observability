'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ProjectConfig } from '@llm-observability/shared/schemas/project';

const STORAGE_KEY = 'llm-obs:last-project-id';

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
  observations: string[];
  scores: { id: string; name: string; value: number; source?: string | null; comment?: string | null }[];
  totalCost: number;
  latency: number;
};

type TracesResponse = {
  data: TraceData[];
  meta: {
    page: number; limit: number; totalItems: number; totalPages: number };
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

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function extractTextFromMessages(data: unknown): string {
  if (!data) return '';
  if (Array.isArray(data)) {
    return data
      .map((m: Record<string, unknown>) => {
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.parts)) {
          return m.parts
            .map((p: Record<string, unknown>) => p.text ?? p.content ?? '')
            .filter(Boolean)
            .join(' ');
        }
        return '';
      })
      .filter(Boolean)
      .join(' | ');
  }
  if (typeof data === 'string') return data;
  return JSON.stringify(data).slice(0, 200);
}

// ===== Component =====

export default function TraceExplorerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlProjectId = searchParams.get('projectId');

  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const [project, setProject] = useState<ProjectConfig | null>(null);
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Search/filter state (applied values sent to API)
  const [filterName, setFilterName] = useState('');
  const [filterSessionId, setFilterSessionId] = useState('');
  const [filterFromTimestamp, setFilterFromTimestamp] = useState('');
  const [filterToTimestamp, setFilterToTimestamp] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  // Input state (local, not yet applied)
  const [inputName, setInputName] = useState('');
  const [inputSessionId, setInputSessionId] = useState('');

  // Fetch project list & initialize selected project
  useEffect(() => {
    fetch('/api/projects')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: ProjectConfig[]) => {
        setProjects(list);
        setProjectsLoading(false);

        if (initializedRef.current) return;
        initializedRef.current = true;

        // 优先级：URL参数 > localStorage > 第一个项目
        const savedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        let selectedId: string | null = null;

        if (urlProjectId && list.some((p) => p.id === urlProjectId)) {
          selectedId = urlProjectId;
        } else if (savedId && list.some((p) => p.id === savedId)) {
          selectedId = savedId;
        } else if (list.length > 0) {
          selectedId = list[0].id;
        }

        if (selectedId) {
          setProjectId(selectedId);
          localStorage.setItem(STORAGE_KEY, selectedId);
        }
      })
      .catch(() => setProjectsLoading(false));
  }, [urlProjectId]);

  // 当 URL projectId 变化时同步（从 Dashboard 点击跳转）
  useEffect(() => {
    if (urlProjectId && urlProjectId !== projectId) {
      setProjectId(urlProjectId);
      localStorage.setItem(STORAGE_KEY, urlProjectId);
    }
  }, [urlProjectId, projectId]);

  // 切换项目
  const handleProjectChange = useCallback(
    (newId: string) => {
      setProjectId(newId);
      localStorage.setItem(STORAGE_KEY, newId);
      // 更新 URL 参数以保持一致性
      router.replace(`/traces?projectId=${newId}`);
    },
    [router],
  );

  // Fetch current project info
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProject)
      .catch(() => {});
  }, [projectId]);

  // Apply filters and reset to page 1
  const applyFilters = useCallback(() => {
    setFilterName(inputName);
    setFilterSessionId(inputSessionId);
    setRefreshToken((n) => n + 1);
    // fromTimestamp/toTimestamp are applied directly via datetime-local
  }, [inputName, inputSessionId]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setInputName('');
    setInputSessionId('');
    setFilterName('');
    setFilterSessionId('');
    setFilterFromTimestamp('');
    setFilterToTimestamp('');
  }, []);

  // Fetch traces with filters
  const fetchTraces = useCallback(
    async (p: number) => {
      if (!projectId) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          projectId,
          page: String(p),
          limit: '20',
        });
        if (filterName) params.set('name', filterName);
        if (filterSessionId) params.set('sessionId', filterSessionId);
        if (filterFromTimestamp) params.set('fromTimestamp', filterFromTimestamp);
        if (filterToTimestamp) params.set('toTimestamp', filterToTimestamp);

        const res = await fetch(`/api/langfuse/traces?${params.toString()}`);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json: TracesResponse = await res.json();
        setTraces(json.data ?? []);
        setTotalPages(json.meta.totalPages);
        setTotalItems(json.meta.totalItems);
        setPage(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load traces');
      } finally {
        setLoading(false);
      }
    },
    [projectId, filterName, filterSessionId, filterFromTimestamp, filterToTimestamp, refreshToken],
  );

  // Auto-fetch when applied filters change
  useEffect(() => {
    if (projectId) fetchTraces(1);
  }, [projectId, fetchTraces]);

  // 加载中或无项目配置
  if (projectsLoading) {
    return (
      <div className="w-full mx-auto px-md">
        <h1 className="font-h1 text-h1 text-on-surface mb-md">Trace Explorer</h1>
        <div className="flex items-center justify-center py-xl">
          <span className="material-symbols-outlined text-[24px] text-on-surface-variant animate-spin mr-sm">progress_activity</span>
          <p className="font-body-md text-body-md text-on-surface-variant">Loading projects...</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="w-full mx-auto px-md">
        <h1 className="font-h1 text-h1 text-on-surface mb-md">Trace Explorer</h1>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block">analytics</span>
          <p className="font-body-md text-body-md text-on-surface-variant mb-md">
            No projects configured yet. Create a project to start viewing traces.
          </p>
          <Link
            href="/settings?new=true"
            className="inline-flex items-center gap-xs bg-primary text-on-primary font-body-md text-body-md py-sm px-lg rounded-lg hover:bg-primary-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Project
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto px-md">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-xs font-body-sm text-body-sm text-on-surface-variant mb-sm">
        <Link href="/" className="hover:text-primary transition-colors">
          Projects
        </Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-on-surface font-medium">{project?.name ?? 'Traces'}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-lg">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Trace Explorer</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">
            {totalItems} trace{totalItems !== 1 ? 's' : ''} found
            {project ? ` in ${project.name}` : ''}
          </p>
        </div>
        {/* Project Selector */}
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">folder</span>
          <select
            value={projectId ?? ''}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="bg-surface-container-lowest border border-outline-variant text-on-surface font-body-sm text-body-sm py-xs px-sm rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none min-w-[180px]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 mb-lg">
        {/* Name filter */}
        <div className="relative w-64">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            type="text"
            placeholder="Filter by exact name..."
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
            className="w-full h-10 bg-surface-container-lowest border border-outline-variant text-on-surface font-body-sm text-body-sm pl-[36px] pr-sm rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        {/* SessionId filter */}
        <div className="relative w-64">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            tag
          </span>
          <input
            type="text"
            placeholder="Filter by session ID..."
            value={inputSessionId}
            onChange={(e) => setInputSessionId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
            className="w-full h-10 bg-surface-container-lowest border border-outline-variant text-on-surface font-body-sm text-body-sm pl-[36px] pr-sm rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        {/* Start date */}
        <div className="relative w-48">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            calendar_today
          </span>
          <input
            type="datetime-local"
            value={filterFromTimestamp ? filterFromTimestamp.slice(0, 16) : ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilterFromTimestamp(val ? new Date(val).toISOString() : '');
            }}
            className="w-full h-10 bg-surface-container-lowest border border-outline-variant text-on-surface font-body-sm text-body-sm pl-[36px] pr-sm rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        {/* End date */}
        <div className="relative w-48">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
            event_busy
          </span>
          <input
            type="datetime-local"
            value={filterToTimestamp ? filterToTimestamp.slice(0, 16) : ''}
            onChange={(e) => {
              const val = e.target.value;
              setFilterToTimestamp(val ? new Date(val).toISOString() : '');
            }}
            className="w-full h-10 bg-surface-container-lowest border border-outline-variant text-on-surface font-body-sm text-body-sm pl-[36px] pr-sm rounded-lg focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={applyFilters}
            className="flex items-center justify-center gap-xs h-10 bg-primary text-on-primary font-body-sm text-body-sm px-md rounded-lg hover:bg-primary-container hover:text-on-primary-container transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            Search
          </button>
          <button
            onClick={clearFilters}
            className="flex items-center justify-center gap-xs h-10 bg-transparent border border-outline-variant text-on-surface-variant font-body-sm text-body-sm px-md rounded-lg hover:bg-surface-container transition-colors whitespace-nowrap cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">filter_clear</span>
            Clear
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-error-container/10 border border-error/30 rounded-lg p-md mb-md flex items-center gap-sm">
          <span className="material-symbols-outlined text-error text-[20px]">error</span>
          <p className="font-body-sm text-body-sm text-error">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="font-mono-label text-mono-label text-on-surface-variant font-medium px-md py-sm whitespace-nowrap">ID / Session ID</th>
                <th className="font-mono-label text-mono-label text-on-surface-variant font-medium px-md py-sm whitespace-nowrap">Name</th>
                <th className="font-mono-label text-mono-label text-on-surface-variant font-medium px-md py-sm whitespace-nowrap">Input Preview</th>
                <th className="font-mono-label text-mono-label text-on-surface-variant font-medium px-md py-sm whitespace-nowrap">Latency</th>
                <th className="font-mono-label text-mono-label text-on-surface-variant font-medium px-md py-sm whitespace-nowrap">Observations</th>
                <th className="font-mono-label text-mono-label text-on-surface-variant font-medium px-md py-sm whitespace-nowrap">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-outline-variant last:border-b-0">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-md py-sm">
                        <div className="h-4 bg-surface-container rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : traces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-md py-xl text-center">
                    <span className="material-symbols-outlined text-[40px] text-on-surface-variant block mb-sm">search_off</span>
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      {(filterName || filterSessionId || filterFromTimestamp || filterToTimestamp) ? 'No traces match your filters.' : 'No traces found for this project.'}
                    </p>
                  </td>
                </tr>
              ) : (
                traces.map((trace) => (
                  <TraceRow
                    key={trace.id}
                    trace={trace}
                    projectId={projectId!}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-md py-sm border-t border-outline-variant bg-surface-container-low">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-sm">
              <button
                disabled={page <= 1 || loading}
                onClick={() => fetchTraces(page - 1)}
                className="flex items-center gap-xs bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-body-sm text-body-sm py-xs px-sm rounded-lg hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                Prev
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => fetchTraces(page + 1)}
                className="flex items-center gap-xs bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-body-sm text-body-sm py-xs px-sm rounded-lg hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Trace Row =====

function TraceRow({
  trace,
  projectId,
}: {
  trace: TraceData;
  projectId: string;
}) {
  const inputPreview = truncate(extractTextFromMessages(trace.input), 80);
  const fullInputText = extractTextFromMessages(trace.input);
  const latencyClass =
    trace.latency > 30
      ? 'text-error'
      : trace.latency > 10
        ? 'text-tertiary'
        : 'text-secondary';

  const detailHref = `/traces/${trace.id}?projectId=${projectId}`;

  return (
    <tr
      className="border-b border-outline-variant last:border-b-0 cursor-pointer transition-colors hover:bg-surface-container-low"
    >
      <td className="px-md py-sm">
        <Link href={detailHref} className="block">
          <div className="font-mono-label text-mono-label text-on-surface">
            {trace.id}
          </div>
          <div className="font-mono-label text-mono-label text-on-surface-variant">
            {trace.sessionId || '—'}
          </div>
        </Link>
      </td>
      <td className="px-md py-sm">
        <Link href={detailHref} className="block">
          <span className="font-body-md text-body-md text-on-surface font-medium">
            {trace.name || 'Untitled'}
          </span>
        </Link>
      </td>
      <td className="px-md py-sm" title={fullInputText || '—'}>
        <Link href={detailHref} className="block">
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate max-w-[300px]">
            {inputPreview || '—'}
          </p>
        </Link>
      </td>
      <td className="px-md py-sm">
        <Link href={detailHref} className="block">
          <span className={`font-mono-code text-mono-code ${latencyClass}`}>
            {formatLatency(trace.latency)}
          </span>
        </Link>
      </td>
      <td className="px-md py-sm">
        <Link href={detailHref} className="block">
          <span className="font-mono-code text-mono-code text-on-surface">
            {trace.observations?.length ?? 0} obs
          </span>
        </Link>
      </td>
      <td className="px-md py-sm">
        <Link href={detailHref} className="block">
          <span className="font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
            {formatDate(trace.createdAt)}
          </span>
        </Link>
      </td>
    </tr>
  );
}