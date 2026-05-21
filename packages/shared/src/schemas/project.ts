import { z } from 'zod';

// ===== Project Configuration =====

export const projectConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional().default(''),
  langfuseBaseUrl: z.string().url('Invalid Langfuse URL'),
  langfusePublicKey: z.string().min(1, 'Public key is required'),
  langfuseSecretKey: z.string().min(1, 'Secret key is required'),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional().default(''),
  langfuseBaseUrl: z.string().url('Invalid Langfuse URL'),
  langfusePublicKey: z.string().min(1, 'Public key is required'),
  langfuseSecretKey: z.string().min(1, 'Secret key is required'),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
  tags: z.array(z.string()).default([]),
});

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid(),
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ===== Langfuse API Response Types =====

export const observationSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  parentObservationId: z.string().nullable().optional(),
  type: z.enum(['SPAN', 'GENERATION', 'EVENT']),
  name: z.string().nullable().optional(),
  startTime: z.string(),
  endTime: z.string().nullable().optional(),
  completionStartTime: z.string().nullable().optional(),
  statusMessage: z.string().nullable().optional(),
  input: z.any().nullable().optional(),
  output: z.any().nullable().optional(),
  metadata: z.any().nullable().optional(),
  model: z.string().nullable().optional(),
  modelParameters: z.any().nullable().optional(),
  usage: z
    .object({
      promptTokens: z.number().nullable().optional(),
      completionTokens: z.number().nullable().optional(),
      totalTokens: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  level: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
});

export const traceSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  input: z.any().nullable().optional(),
  output: z.any().nullable().optional(),
  metadata: z.any().nullable().optional(),
  timestamp: z.string(),
  release: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  publicLogpoint: z.boolean().nullable().optional(),
  observations: z.array(observationSchema).optional(),
  scores: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        value: z.number(),
        source: z.string().nullable().optional(),
        comment: z.string().nullable().optional(),
      }),
    )
    .optional(),
});

export type Observation = z.infer<typeof observationSchema>;
export type Trace = z.infer<typeof traceSchema>;
