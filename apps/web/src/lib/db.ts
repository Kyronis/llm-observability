import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { ProjectConfig, CreateProjectInput, UpdateProjectInput } from '@llm-observability/shared/schemas/project';

// DB file location — use DATA_DIR env or project root
const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'llm-observability.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initializeSchema(_db);
  return _db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      langfuse_base_url  TEXT NOT NULL,
      langfuse_public_key TEXT NOT NULL,
      langfuse_secret_key TEXT NOT NULL,
      environment   TEXT NOT NULL DEFAULT 'production',
      tags          TEXT NOT NULL DEFAULT '[]',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
  `);
}

// ===== CRUD Operations =====

export function listProjects(): ProjectConfig[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as RawProjectRow[];
  return rows.map(rowToProject);
}

export function getProject(id: string): ProjectConfig | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as RawProjectRow | undefined;
  return row ? rowToProject(row) : undefined;
}

export function createProject(input: CreateProjectInput): ProjectConfig {
  const db = getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  db.prepare(
    `INSERT INTO projects (id, name, description, langfuse_base_url, langfuse_public_key, langfuse_secret_key, environment, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name,
    input.description ?? '',
    input.langfuseBaseUrl,
    input.langfusePublicKey,
    input.langfuseSecretKey,
    input.environment ?? 'production',
    JSON.stringify(input.tags ?? []),
    now,
    now,
  );

  return getProject(id)!;
}

export function updateProject(input: UpdateProjectInput): ProjectConfig {
  const db = getDb();
  const existing = getProject(input.id);
  if (!existing) throw new Error('Project not found');

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
  if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
  if (input.langfuseBaseUrl !== undefined) { fields.push('langfuse_base_url = ?'); values.push(input.langfuseBaseUrl); }
  if (input.langfusePublicKey !== undefined) { fields.push('langfuse_public_key = ?'); values.push(input.langfusePublicKey); }
  if (input.langfuseSecretKey !== undefined) { fields.push('langfuse_secret_key = ?'); values.push(input.langfuseSecretKey); }
  if (input.environment !== undefined) { fields.push('environment = ?'); values.push(input.environment); }
  if (input.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(input.tags)); }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(input.id);

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getProject(input.id)!;
}

export function deleteProject(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
}

// ===== Helpers =====

interface RawProjectRow {
  id: string;
  name: string;
  description: string;
  langfuse_base_url: string;
  langfuse_public_key: string;
  langfuse_secret_key: string;
  environment: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: RawProjectRow): ProjectConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    langfuseBaseUrl: row.langfuse_base_url,
    langfusePublicKey: row.langfuse_public_key,
    langfuseSecretKey: row.langfuse_secret_key,
    environment: row.environment as 'production' | 'staging' | 'development',
    tags: JSON.parse(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
