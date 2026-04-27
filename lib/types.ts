export type Provider = 'anthropic' | 'google' | 'openai';

export interface ProviderConfig {
  label: string;
  keyPlaceholder: string;
  keyHelpUrl: string;
  keyHelpLabel: string;
  defaultModel: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  anthropic: {
    label: 'Claude (Anthropic)',
    keyPlaceholder: 'sk-ant-...',
    keyHelpUrl: 'https://console.anthropic.com',
    keyHelpLabel: 'console.anthropic.com',
    defaultModel: 'claude-3-5-haiku-20241022',
  },
  google: {
    label: 'Gemini (Google)',
    keyPlaceholder: 'AIza...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    keyHelpLabel: 'aistudio.google.com',
    defaultModel: 'gemini-2.0-flash',
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyHelpLabel: 'platform.openai.com',
    defaultModel: 'gpt-4o-mini',
  },
};

export interface Summaries {
  twitter: string;
  thread: string;
  linkedin: string;
  geekNews: string;
}

export interface SummarizeResult {
  summaries: Summaries;
  error?: never;
}

export interface SummarizeError {
  summaries?: never;
  error: string;
}

export type SummarizeResponse = SummarizeResult | SummarizeError;

export const PLATFORM_LIMITS = {
  twitter: 250,
  thread: 500,
  linkedin: 800,
  geekNews: 1000,
} as const;

export const PLATFORM_LABELS: Record<keyof Summaries, string> = {
  twitter: '🐦 Twitter',
  thread: '🧵 Thread',
  linkedin: '💼 LinkedIn',
  geekNews: '🤓 Geek News',
};
