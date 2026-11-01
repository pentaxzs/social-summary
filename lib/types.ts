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

export interface PlatformMeta {
  /** 신문 섹션 번호 — 지면 순서를 그대로 쓴다 */
  no: string;
  label: string;
  /** 잉크 톤으로 옮긴 플랫폼 식별색 */
  color: string;
}

export const TONES = [
  { key: 'casual',       label: '캐주얼하게', instruction: '친구에게 말하듯 편안한 구어체로. 격식은 빼되 내용은 유지.' },
  { key: 'professional', label: '전문적으로', instruction: '업무 문서 수준의 정제된 문장으로. 감탄사와 이모지는 줄인다.' },
  { key: 'friendly',     label: '친근하게',   instruction: '따뜻하고 다정한 말투로. 독자를 배려하는 어조.' },
  { key: 'assertive',    label: '단호하게',   instruction: '주장을 분명히 드러내는 단정적인 어조로. 군더더기를 걷어낸다.' },
] as const;

export type Tone = (typeof TONES)[number]['key'];

/** 카드 하나를 다시 만들 때 쓰는 지시 */
export type RegenerateMode = 'regenerate' | 'shorter' | Tone;

export interface PlatformSummaries {
  twitter: string;
  thread: string;
  linkedin: string;
  geekNews: string;
}

export type TextPlatform = keyof PlatformSummaries;
export type Platform = TextPlatform | 'instagram' | 'instagramPhoto';

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
  // outro
  /** 밑줄이 그어지는 안내 문구 */
  cta?: string;
  /** 카드 맨 아래 주소·핸들 */
  handle?: string;
}

export interface InstagramPost {
  title: string;
  slides: InstagramSlide[];
  caption: string;
  /**
   * 원문 레터 말미의 다음 편 예고를 카드 2줄로 줄인 것.
   * 예고가 없는 글이면 비어 있다.
   */
  next_story?: string;
}

export interface InstagramPhotoSlide extends InstagramSlide {
  image_url: string;
}

export interface InstagramPhotoPost {
  title: string;
  slides: InstagramPhotoSlide[];
  caption: string;
  next_story?: string;
}

/** 첫 생성 때 추출한 원문. 재생성 시 다시 긁지 않으려고 클라이언트가 들고 있는다 */
export interface SourceDoc {
  title: string;
  content: string;
}

export interface SummarizeResult {
  summaries: Partial<PlatformSummaries>;
  instagramPost: InstagramPost | null;
  instagramPhotoPost: InstagramPhotoPost | null;
  source: SourceDoc;
  error?: never;
}

export interface SummarizeError {
  summaries?: never;
  instagramPost?: never;
  instagramPhotoPost?: never;
  source?: never;
  error: string;
}

export const ALL_PLATFORMS: Platform[] = ['twitter', 'thread', 'linkedin', 'geekNews', 'instagram', 'instagramPhoto'];

export const PLATFORM_LABELS_ALL: Record<Platform, string> = {
  twitter: '𝕏 Twitter',
  thread: '🧵 Thread',
  linkedin: '💼 LinkedIn',
  geekNews: '🤓 Geek News',
  instagram: '📸 Instagram',
  instagramPhoto: '🖼️ Instagram w/photo',
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

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  twitter:        { no: '01', label: '𝕏 Twitter',  color: '#14120e' },
  thread:         { no: '02', label: 'Thread',     color: '#3b352a' },
  linkedin:       { no: '03', label: 'LinkedIn',   color: '#1b3a55' },
  geekNews:       { no: '04', label: 'Geek News',  color: '#7a3d12' },
  instagram:      { no: '05', label: 'Instagram',  color: '#6e1b33' },
  instagramPhoto: { no: '06', label: '사진 카드',   color: '#6e1b33' },
};
