export interface LLMCall {
  id: string;
  model: string;
  prompt: string;
  completion: string;
  latencyMs: number;
  tokenUsage: TokenUsage;
  createdAt: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
