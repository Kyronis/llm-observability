import { z } from 'zod';

export const llmCallSchema = z.object({
  model: z.string().min(1),
  prompt: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export type LLMCallInput = z.infer<typeof llmCallSchema>;
