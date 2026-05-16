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
    defaultModel: 'claude-haiku-4-5-20251001',
  },
  google: {
    label: 'Gemini (Google)',
    keyPlaceholder: 'AIza...',
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    keyHelpLabel: 'aistudio.google.com',
    defaultModel: 'gemini-2.5-flash',
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyHelpLabel: 'platform.openai.com',
    defaultModel: 'gpt-4o-mini',
  },
};

export interface PlatformSummaries {
  twitter: string;
  thread: string;
  linkedin: string;
  geekNews: string;
}

export type TextPlatform = keyof PlatformSummaries;
export type Platform = TextPlatform | 'instagram';

export type InstagramSlideLayout = 'cover' | 'content' | 'stat' | 'outro';

export interface InstagramSlide {
  slide_number: number;
  layout?: InstagramSlideLayout;
  headline: string;
  body?: string;
  background_color: string;
  accent_color: string;
  // cover
  label?: string;
  // content
  keyword?: string;
  // stat
  stat_value?: string;
  stat_unit?: string;
  stat_badge?: string;
  source?: string;
}

export interface InstagramPost {
  title: string;
  slides: InstagramSlide[];
  caption: string;
}

export interface SummarizeResult {
  summaries: Partial<PlatformSummaries>;
  instagramPost: InstagramPost | null;
  error?: never;
}

export interface SummarizeError {
  summaries?: never;
  instagramPost?: never;
  error: string;
}

export const ALL_PLATFORMS: Platform[] = ['twitter', 'thread', 'linkedin', 'geekNews', 'instagram'];

export const PLATFORM_LABELS_ALL: Record<Platform, string> = {
  twitter: '𝕏 Twitter',
  thread: '🧵 Thread',
  linkedin: '💼 LinkedIn',
  geekNews: '🤓 Geek News',
  instagram: '📸 Instagram',
};

export type SummarizeResponse = SummarizeResult | SummarizeError;

export const PLATFORM_LIMITS: Record<keyof PlatformSummaries, number> = {
  twitter: 250,
  thread: 500,
  linkedin: 800,
  geekNews: 1200,
} as const;

export const PLATFORM_LABELS: Record<keyof PlatformSummaries, string> = {
  twitter: '𝕏 Twitter',
  thread: '🧵 Thread',
  linkedin: '💼 LinkedIn',
  geekNews: '🤓 Geek News',
};
