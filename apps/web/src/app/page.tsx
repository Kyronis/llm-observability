'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProjectConfig } from '@llm-observability/shared/schemas/project';

type ProjectWithStats = ProjectConfig & {
  healthStatus: 'healthy' | 'degraded';
  models: string[];
  traces24h: string;
  p95Latency: string;
  cost24h: string;
  errorRate: string;
};

type ViewMode = 'grid' | 'list';

const mockStats = {
  totalTraces24h: '1.24M',
  totalTracesTrend: '+12.5%',
  totalTracesTrendDir: 'up' as const,
  avgLatency: '842ms',
  avgLatencyTrend: '-4.2%',
  avgLatencyTrendDir: 'down' as const,
  estCost24h: '$482.50',
  estCostTrend: '+2.1%',
  estCostTrendDir: 'up' as const,
  activeModels: 14,
  modelTags: ['GPT-4', 'Claude 3'],
};

export default function ProjectsDashboard() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'cost'>('recent');

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  }

  // Map projects to include display stats (mock data for now, will be from Langfuse API later)
  const projectsWithStats: ProjectWithStats[] = projects.map((p, i) => ({
    ...p,
    healthStatus: i % 3 === 1 ? ('degraded' as const) : ('healthy' as const),
    models: ['GPT-4 Turbo', 'Claude 3 Haiku', 'Mistral Large'][i % 3] ? [(['GPT-4 Turbo', 'Claude 3 Haiku', 'Mistral Large'] as string[])[i % 3]] : [],
    traces24h: ['452,189', '12,450', '89,201'][i % 3] ?? '0',
    p95Latency: ['1,240ms', '4,820ms', '850ms'][i % 3] ?? '—',
    cost24h: ['$124.50', '$12.20', '$45.80'][i % 3] ?? '$0',
    errorRate: ['0.4%', '5.2%', '0.1%'][i % 3] ?? '—',
  }));

  const sorted = [...projectsWithStats].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0; // 'recent' is already sorted by updatedAt desc from API
  });

  return (
    <div className="max-w-[1600px] w-full mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-xl">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface md:text-h1 text-h1-mobile md:font-h1 font-h1-mobile">
            Projects
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            Manage and monitor your deployed LLM applications.
          </p>
        </div>
        <Link
          href="/settings?new=true"
          className="bg-primary text-on-primary font-body-md text-body-md py-sm px-lg rounded-lg flex items-center gap-xs hover:bg-primary-container transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Project
        </Link>
      </div>

      {/* Global Stats Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter mb-xl">
        {/* Total Traces */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0px_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Total Traces (24h)</span>
            <span className="material-symbols-outlined text-primary text-[18px]">show_chart</span>
          </div>
          <div className="font-h2 text-h2 text-on-surface mb-xs">{mockStats.totalTraces24h}</div>
          <div className="flex items-center gap-xs text-secondary">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            <span className="font-mono-label text-mono-label">{mockStats.totalTracesTrend}</span>
          </div>
        </div>
        {/* Avg Latency */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0px_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Global Avg Latency</span>
            <span className="material-symbols-outlined text-tertiary text-[18px]">speed</span>
          </div>
          <div className="font-h2 text-h2 text-on-surface mb-xs">{mockStats.avgLatency}</div>
          <div className="flex items-center gap-xs text-secondary">
            <span className="material-symbols-outlined text-[14px]">trending_down</span>
            <span className="font-mono-label text-mono-label">{mockStats.avgLatencyTrend}</span>
          </div>
        </div>
        {/* Est. Cost */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0px_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Est. Cost (24h)</span>
            <span className="material-symbols-outlined text-primary-container text-[18px]">payments</span>
          </div>
          <div className="font-h2 text-h2 text-on-surface mb-xs">{mockStats.estCost24h}</div>
          <div className="flex items-center gap-xs text-error">
            <span className="material-symbols-outlined text-[14px]">trending_up</span>
            <span className="font-mono-label text-mono-label">{mockStats.estCostTrend}</span>
          </div>
        </div>
        {/* Active Models */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-[0px_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex justify-between items-start mb-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant font-medium">Active Models</span>
            <span className="material-symbols-outlined text-on-surface-variant text-[18px]">memory</span>
          </div>
          <div className="font-h2 text-h2 text-on-surface mb-xs">{mockStats.activeModels}</div>
          <div className="flex gap-xs mt-xs">
            {mockStats.modelTags.map((tag) => (
              <span key={tag} className="px-2 py-1 bg-surface-container rounded font-mono-label text-mono-label text-on-surface-variant">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Controls: Filter / Sort / View Toggle */}
      <div className="flex justify-between items-center mb-md border-b border-surface-container pb-sm">
        <div className="flex gap-sm">
          <button className="bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-body-sm text-body-sm py-xs px-sm rounded-lg flex items-center gap-xs hover:bg-surface-container-low transition-colors">
            <span className="material-symbols-outlined text-[16px]">filter_list</span>
            Filter
          </button>
          <div className="relative">
            <select
              className="bg-surface-container-lowest border border-outline-variant text-on-surface font-body-sm text-body-sm py-xs pl-sm pr-lg rounded-lg appearance-none focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'cost')}
            >
              <option value="recent">Sort by: Recent</option>
              <option value="name">Sort by: Name</option>
              <option value="cost">Sort by: Cost</option>
            </select>
            <span className="material-symbols-outlined absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[16px] pointer-events-none">
              expand_more
            </span>
          </div>
        </div>
        <div className="flex gap-xs bg-surface-container-lowest border border-outline-variant rounded-lg p-xs">
          <button
            className={`p-1 rounded ${viewMode === 'grid' ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
            onClick={() => setViewMode('grid')}
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
          </button>
          <button
            className={`p-1 rounded ${viewMode === 'list' ? 'bg-surface-container text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
            onClick={() => setViewMode('list')}
          >
            <span className="material-symbols-outlined text-[18px]">list</span>
          </button>
        </div>
      </div>

      {/* Projects Grid / List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md animate-pulse h-64" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-2xl text-center">
          <span className="material-symbols-outlined text-[64px] text-on-surface-variant mb-md">folder_open</span>
          <h3 className="font-h3 text-h3 text-on-surface mb-xs">No projects yet</h3>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg max-w-md">
            Create your first Langfuse project to start monitoring your LLM applications.
          </p>
          <Link
            href="/settings?new=true"
            className="bg-primary text-on-primary font-body-md text-body-md py-sm px-lg rounded-lg flex items-center gap-xs hover:bg-primary-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create First Project
          </Link>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
          {sorted.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        /* List View */
        <div className="flex flex-col gap-sm">
          {sorted.map((project) => (
            <ProjectListItem key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectWithStats }) {
  const isDegraded = project.healthStatus === 'degraded';

  return (
    <Link
      href={`/traces?projectId=${project.id}`}
      className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-[0px_1px_3px_rgba(15,23,42,0.05)] hover:shadow-[0px_10px_15px_-3px_rgba(15,23,42,0.1)] transition-shadow group cursor-pointer flex flex-col"
    >
      {/* Card Header */}
      <div className="p-md border-b border-surface-container-low flex justify-between items-start">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <h3 className="font-h3 text-h3 text-on-surface">{project.name}</h3>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{project.description || 'No description'}</p>
        </div>
        <button className="text-on-surface-variant hover:text-on-surface p-xs opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-[20px]">more_vert</span>
        </button>
      </div>

      {/* Tags & Stats */}
      <div className="p-md flex-1">
        <div className="flex flex-wrap gap-xs mb-md">
          <span className={`px-2 py-1 ${isDegraded ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'} rounded font-mono-label text-mono-label flex items-center gap-xs`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isDegraded ? 'bg-error animate-pulse' : 'bg-secondary'}`} />
            {isDegraded ? 'Degraded' : 'Healthy'}
          </span>
          <span className="px-2 py-1 border border-outline-variant rounded font-mono-label text-mono-label text-on-surface-variant capitalize">
            {project.environment}
          </span>
          {project.models.map((m) => (
            <span key={m} className="px-2 py-1 bg-surface-container rounded font-mono-label text-mono-label text-on-surface-variant">
              {m}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-xs">Traces (24h)</p>
            <p className="font-mono-code text-mono-code text-on-surface">{project.traces24h}</p>
          </div>
          <div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-xs">P95 Latency</p>
            <p className={`font-mono-code text-mono-code ${isDegraded ? 'text-error' : 'text-on-surface'}`}>{project.p95Latency}</p>
          </div>
          <div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-xs">Cost (24h)</p>
            <p className="font-mono-code text-mono-code text-on-surface">{project.cost24h}</p>
          </div>
          <div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-xs">Error Rate</p>
            <p className={`font-mono-code text-mono-code ${isDegraded ? 'text-error' : 'text-on-surface'}`}>{project.errorRate}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-surface-container-low px-md py-sm rounded-b-lg border-t border-surface-container flex justify-between items-center mt-auto">
        <span className="font-body-sm text-body-sm text-on-surface-variant">
          Updated {getRelativeTime(project.updatedAt)}
        </span>
        <span className="material-symbols-outlined text-primary text-[18px] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0">
          arrow_forward
        </span>
      </div>
    </Link>
  );
}

function ProjectListItem({ project }: { project: ProjectWithStats }) {
  const isDegraded = project.healthStatus === 'degraded';

  return (
    <Link
      href={`/traces?projectId=${project.id}`}
      className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md hover:shadow-[0px_4px_8px_rgba(15,23,42,0.08)] transition-shadow group cursor-pointer flex items-center gap-lg"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-sm mb-xs">
          <h3 className="font-h3 text-h3 text-on-surface truncate">{project.name}</h3>
          <span className={`px-2 py-1 ${isDegraded ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'} rounded font-mono-label text-mono-label flex items-center gap-xs shrink-0`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isDegraded ? 'bg-error animate-pulse' : 'bg-secondary'}`} />
            {isDegraded ? 'Degraded' : 'Healthy'}
          </span>
          <span className="px-2 py-1 border border-outline-variant rounded font-mono-label text-mono-label text-on-surface-variant capitalize shrink-0">
            {project.environment}
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{project.description || 'No description'}</p>
      </div>
      <div className="flex items-center gap-lg shrink-0">
        <div className="text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">Traces</p>
          <p className="font-mono-code text-mono-code text-on-surface">{project.traces24h}</p>
        </div>
        <div className="text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">P95</p>
          <p className={`font-mono-code text-mono-code ${isDegraded ? 'text-error' : 'text-on-surface'}`}>{project.p95Latency}</p>
        </div>
        <div className="text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">Cost</p>
          <p className="font-mono-code text-mono-code text-on-surface">{project.cost24h}</p>
        </div>
        <span className="material-symbols-outlined text-primary text-[18px] opacity-0 group-hover:opacity-100 transition-opacity">
          arrow_forward
        </span>
      </div>
    </Link>
  );
}

function getRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
