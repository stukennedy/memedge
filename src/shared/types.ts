import { z } from 'zod';

/**
 * Message types for conversation history
 */
export type Message = {
  role: 'user' | 'assistant' | 'tool';
  content:
    | string
    | Array<{
        type: 'tool-result';
        toolCallId: string;
        toolName: string;
        output: any;
      }>;
};

/**
 * URL configuration for external services
 */
export interface UrlConfig {
  url: string;
  region?: string;
  secret?: string;
}

/**
 * LLM provider configuration
 */
export interface LlmConfig {
  id: string;
  format: 'openai' | 'azure_openai' | 'gemini' | 'none';
  urls?: UrlConfig[];
  secret?: string;
  model_name?: string;
  deployment_name?: string;
  api_version?: string;
  temperature?: number;
  max_tokens?: number;
  metadata?: Record<string, any>;
}

/**
 * Agent/Persona configuration
 */
export interface PersonaConfig {
  name: string;
  system_prompt: string;
  personality?: string;
  llm_config?: LlmConfig;
  language_config?: {
    language_code: string;
  };
  metadata?: Record<string, any>;
  tools?: {
    [key: string]: {
      description: string;
      inputSchema: z.ZodTypeAny;
    };
  };
}
