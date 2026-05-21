'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ProjectConfig } from '@llm-observability/shared/schemas/project';

type FormData = {
  name: string;
  description: string;
  langfuseBaseUrl: string;
  langfusePublicKey: string;
  langfuseSecretKey: string;
  environment: 'production' | 'staging' | 'development';
  tags: string;
};

const emptyForm: FormData = {
  name: '',
  description: '',
  langfuseBaseUrl: '',
  langfusePublicKey: '',
  langfuseSecretKey: '',
  environment: 'production',
  tags: '',
};

export default function SettingsContent() {
  const [projects, setProjects] = useState<ProjectConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProject, setEditingProject] = useState<ProjectConfig | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetchProjects();
    if (searchParams.get('new') === 'true') {
      setShowForm(true);
      setEditingProject(null);
      setForm(emptyForm);
    }
  }, [searchParams]);

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

  const handleEdit = useCallback((project: ProjectConfig) => {
    setEditingProject(project);
    setForm({
      name: project.name,
      description: project.description ?? '',
      langfuseBaseUrl: project.langfuseBaseUrl,
      langfusePublicKey: project.langfusePublicKey,
      langfuseSecretKey: project.langfuseSecretKey,
      environment: project.environment,
      tags: project.tags?.join(', ') ?? '',
    });
    setShowForm(true);
    setError(null);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingProject(null);
    setForm(emptyForm);
    setError(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      description: form.description,
      langfuseBaseUrl: form.langfuseBaseUrl,
      langfusePublicKey: form.langfusePublicKey,
      langfuseSecretKey: form.langfuseSecretKey,
      environment: form.environment,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      const url = editingProject ? `/api/projects/${editingProject.id}` : '/api/projects';
      const method = editingProject ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save project');
      }

      await fetchProjects();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProjects();
        setDeleteConfirmId(null);
        if (editingProject?.id === id) handleCancel();
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleTestConnection = async () => {
    setError(null);
    try {
      const res = await fetch('/api/langfuse/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: form.langfuseBaseUrl,
          publicKey: form.langfusePublicKey,
          secretKey: form.langfuseSecretKey,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setError(null);
        alert('Connection successful!');
      } else {
        setError(data.error ?? 'Connection failed');
      }
    } catch {
      setError('Connection test failed — check URL and keys');
    }
  };

  return (
    <div className="max-w-[1200px] w-full mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-xl">
        <div>
          <h1 className="font-h1 text-h1 text-on-surface">Settings</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
            Configure Langfuse project connections.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setEditingProject(null); setForm(emptyForm); setError(null); }}
            className="bg-primary text-on-primary font-body-md text-body-md py-sm px-lg rounded-lg flex items-center gap-xs hover:bg-primary-container transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Project
          </button>
        )}
      </div>

      {/* Project Form */}
      {showForm && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg mb-xl shadow-[0px_1px_3px_rgba(15,23,42,0.05)]">
          <h2 className="font-h2 text-h2 text-on-surface mb-lg">
            {editingProject ? 'Edit Project' : 'New Project'}
          </h2>

          {error && (
            <div className="bg-error-container/30 border border-error/20 text-error rounded-lg p-md mb-md font-body-md text-body-md flex items-center gap-sm">
              <span className="material-symbols-outlined text-[18px]">error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-lg">
            {/* Name & Environment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div>
                <label className="font-body-sm text-body-sm text-on-surface-variant font-medium block mb-xs">
                  Project Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  placeholder="e.g. Customer Support Agent"
                />
              </div>
              <div>
                <label className="font-body-sm text-body-sm text-on-surface-variant font-medium block mb-xs">
                  Environment
                </label>
                <select
                  value={form.environment}
                  onChange={(e) => setForm({ ...form, environment: e.target.value as FormData['environment'] })}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all appearance-none"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="font-body-sm text-body-sm text-on-surface-variant font-medium block mb-xs">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all resize-none"
                placeholder="Brief description of this LLM application"
              />
            </div>

            {/* Langfuse Configuration */}
            <div className="border border-outline-variant rounded-lg p-md bg-surface-container-low">
              <h3 className="font-h3 text-h3 text-on-surface mb-md flex items-center gap-sm">
                <span className="material-symbols-outlined text-[20px] text-primary">vpn_key</span>
                Langfuse Connection
              </h3>
              <div className="space-y-md">
                <div>
                  <label className="font-body-sm text-body-sm text-on-surface-variant font-medium block mb-xs">
                    Base URL <span className="text-error">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={form.langfuseBaseUrl}
                    onChange={(e) => setForm({ ...form, langfuseBaseUrl: e.target.value })}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono-code text-[13px]"
                    placeholder="https://langfuse.yourcompany.com"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div>
                    <label className="font-body-sm text-body-sm text-on-surface-variant font-medium block mb-xs">
                      Public Key <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.langfusePublicKey}
                      onChange={(e) => setForm({ ...form, langfusePublicKey: e.target.value })}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono-code text-[13px]"
                      placeholder="pk-xxx"
                    />
                  </div>
                  <div>
                    <label className="font-body-sm text-body-sm text-on-surface-variant font-medium block mb-xs">
                      Secret Key <span className="text-error">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      value={form.langfuseSecretKey}
                      onChange={(e) => setForm({ ...form, langfuseSecretKey: e.target.value })}
                      className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all font-mono-code text-[13px]"
                      placeholder="sk-xxx"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  className="flex items-center gap-xs text-primary font-body-sm text-body-sm hover:underline"
                >
                  <span className="material-symbols-outlined text-[16px]">link</span>
                  Test Connection
                </button>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="font-body-sm text-body-sm text-on-surface-variant font-medium block mb-xs">
                Tags <span className="font-body-sm text-body-sm text-on-surface-variant">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-body-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                placeholder="e.g. gpt-4, production, rag"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-sm pt-sm">
              <button
                type="submit"
                disabled={saving}
                className="bg-primary text-on-primary font-body-md text-body-md py-sm px-lg rounded-lg flex items-center gap-xs hover:bg-primary-container transition-colors shadow-sm disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{editingProject ? 'save' : 'add'}</span>
                {saving ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-body-md text-body-md py-sm px-lg rounded-lg hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project List */}
      <h2 className="font-h2 text-h2 text-on-surface mb-md">Configured Projects</h2>

      {loading ? (
        <div className="space-y-sm">
          {[1, 2].map((i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md animate-pulse h-20" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant mb-sm block">cloud_off</span>
          <p className="font-body-md text-body-md text-on-surface-variant">
            No projects configured. Add a Langfuse project to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-sm">
          {projects.map((project) => (
            <div
              key={project.id}
              className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md flex items-center gap-md hover:shadow-[0px_2px_6px_rgba(15,23,42,0.06)] transition-shadow"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-sm mb-xs">
                  <h3 className="font-h3 text-h3 text-on-surface truncate">{project.name}</h3>
                  <span className="px-2 py-1 border border-outline-variant rounded font-mono-label text-mono-label text-on-surface-variant capitalize shrink-0">
                    {project.environment}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {project.langfuseBaseUrl}
                </p>
              </div>
              <div className="flex items-center gap-xs shrink-0">
                <button
                  onClick={() => handleEdit(project)}
                  className="p-sm text-on-surface-variant hover:text-primary hover:bg-surface-container-low rounded-lg transition-colors"
                  title="Edit"
                >
                  <span className="material-symbols-outlined text-[20px]">edit</span>
                </button>
                {deleteConfirmId === project.id ? (
                  <div className="flex items-center gap-xs">
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="px-sm py-xs bg-error text-on-error font-body-sm text-body-sm rounded-lg"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-sm py-xs border border-outline-variant text-on-surface-variant font-body-sm text-body-sm rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmId(project.id)}
                    className="p-sm text-on-surface-variant hover:text-error hover:bg-error-container/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
