'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
const HEADER_EMOJIS = ['📰', '🗞️', '✒️', '🖋️', '📜'];
import { ApiKeyInput } from '@/components/ApiKeyInput';
import { SummaryCard } from '@/components/SummaryCard';
import { InstagramCard } from '@/components/InstagramCard';
import { InstagramPhotoCard } from '@/components/InstagramPhotoCard';
import { summarizeUrl } from '@/app/actions/summarize';
import { regenerateSlideImage } from '@/app/actions/image-sources';
import {
  Provider,
  Platform,
  PlatformSummaries,
  InstagramPost,
  InstagramPhotoPost,
  ALL_PLATFORMS,
  PLATFORM_LABELS_ALL,
} from '@/lib/types';

const LS_PROVIDER = 'ss_provider';
const LS_API_KEY = 'ss_api_key';
const LS_HISTORY = 'ss_history';
const LS_UNSPLASH_KEY = 'ss_unsplash_key';
const LS_OPENAI_IMAGE_KEY = 'ss_openai_image_key';

const PLATFORM_SELECTED_STYLE: Record<Platform, string> = {
  twitter:   'bg-neutral-900 border-neutral-900 text-amber-50',
  thread:    'bg-neutral-900 border-neutral-900 text-amber-50',
  linkedin:  'bg-neutral-900 border-neutral-900 text-amber-50',
  geekNews:  'bg-neutral-900 border-neutral-900 text-amber-50',
  instagram: 'bg-neutral-900 border-neutral-900 text-amber-50',
  instagramPhoto: 'bg-neutral-900 border-neutral-900 text-amber-50',
};

const PLATFORM_HOVER_STYLE: Record<Platform, string> = {
  twitter:   'hover:border-neutral-600 hover:text-neutral-900',
  thread:    'hover:border-neutral-600 hover:text-neutral-900',
  linkedin:  'hover:border-neutral-600 hover:text-neutral-900',
  geekNews:  'hover:border-neutral-600 hover:text-neutral-900',
  instagram: 'hover:border-neutral-600 hover:text-neutral-900',
  instagramPhoto: 'hover:border-neutral-600 hover:text-neutral-900',
};

export default function Home() {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [url, setUrl] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(
    () => new Set([ALL_PLATFORMS[Math.floor(Math.random() * ALL_PLATFORMS.length)]])
  );
  const [toast, setToast] = useState(false);
  const [summaries, setSummaries] = useState<Partial<PlatformSummaries> | null>(null);
  const [instagramPost, setInstagramPost] = useState<InstagramPost | null>(null);
  const [instagramPhotoPost, setInstagramPhotoPost] = useState<InstagramPhotoPost | null>(null);
  const [unsplashKey, setUnsplashKey] = useState('');
  const [openaiImageKey, setOpenaiImageKey] = useState('');
  const [submittedPlatforms, setSubmittedPlatforms] = useState<Set<Platform>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const loadingRef = useRef<HTMLDivElement>(null);
  const [headerEmoji] = useState(() => HEADER_EMOJIS[Math.floor(Math.random() * HEADER_EMOJIS.length)]);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending && loadingRef.current) {
      loadingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isPending]);

  useEffect(() => {
    const savedProvider = localStorage.getItem(LS_PROVIDER) as Provider | null;
    const savedKey = localStorage.getItem(LS_API_KEY);
    const savedHistory = localStorage.getItem(LS_HISTORY);
    if (savedProvider) setProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    const savedUnsplashKey = localStorage.getItem(LS_UNSPLASH_KEY);
    const savedOpenaiImageKey = localStorage.getItem(LS_OPENAI_IMAGE_KEY);
    if (savedUnsplashKey) setUnsplashKey(savedUnsplashKey);
    if (savedOpenaiImageKey) setOpenaiImageKey(savedOpenaiImageKey);
  }, []);

  function handleProviderChange(p: Provider) {
    setProvider(p);
    localStorage.setItem(LS_PROVIDER, p);
  }

  function handleApiKeyChange(key: string) {
    setApiKey(key);
    localStorage.setItem(LS_API_KEY, key);
  }

  function handleUnsplashKeyChange(key: string) {
    setUnsplashKey(key);
    localStorage.setItem(LS_UNSPLASH_KEY, key);
  }

  function handleOpenaiImageKeyChange(key: string) {
    setOpenaiImageKey(key);
    localStorage.setItem(LS_OPENAI_IMAGE_KEY, key);
  }

  function togglePlatform(platform: Platform) {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }

  function handleSlideImageChange(slideIndex: number, newUrl: string, bgColor?: string) {
    if (!instagramPhotoPost) return;
    const updated = { ...instagramPhotoPost, slides: instagramPhotoPost.slides.map((s, i) =>
      i === slideIndex ? { ...s, image_url: newUrl, ...(bgColor ? { background_color: bgColor } : {}) } : s
    )};
    setInstagramPhotoPost(updated);
  }

  async function handleRegenerateImage(slideIndex: number, source: 'unsplash' | 'gpt') {
    if (!instagramPhotoPost) return;
    const slide = instagramPhotoPost.slides[slideIndex];
    if (!slide) return;

    console.log(`[ImageReplace] slide=${slideIndex}, source=${source}, headline="${slide.headline}"`);
    setIsRegeneratingImage(true);
    setImageError(null);
    try {
      const effectiveOpenaiKey = provider === 'openai' ? apiKey : openaiImageKey;
      console.log(`[ImageReplace] unsplashKey=${unsplashKey ? 'SET' : 'EMPTY'}, openaiKey=${effectiveOpenaiKey ? 'SET' : 'EMPTY'}`);
      const result = await regenerateSlideImage(
        source, slide.headline, slide.keyword,
        unsplashKey || undefined,
        effectiveOpenaiKey || undefined,
        slide.image_url || undefined,
      );
      console.log(`[ImageReplace] result: url=${result.url ? 'OK' : 'NULL'}, error=${result.error || 'none'}`);
      if (result.url) {
        handleSlideImageChange(slideIndex, result.url);
      } else {
        setImageError(result.error || '이미지를 가져오지 못했습니다');
      }
    } catch (err) {
      console.error('[ImageReplace] Error:', err);
      setImageError('이미지 생성 중 오류가 발생했습니다');
    } finally {
      setIsRegeneratingImage(false);
    }
  }

  function showToast() {
    setToast(true);
    setTimeout(() => setToast(false), 2500);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !url || selectedPlatforms.size === 0) return;

    setError(null);
    setSummaries(null);
    setInstagramPost(null);
    setInstagramPhotoPost(null);

    const platformsSnapshot = new Set(selectedPlatforms);
    setSubmittedPlatforms(platformsSnapshot);

    startTransition(async () => {
      try {
        const result = await summarizeUrl(
          url, provider, apiKey, Array.from(platformsSnapshot),
          unsplashKey || undefined,
          provider === 'openai' ? apiKey : openaiImageKey || undefined,
        );

        if ('error' in result && result.error) {
          setError(result.error);
          return;
        }

        setSummaries(result.summaries ?? null);
        setInstagramPost(result.instagramPost ?? null);
        setInstagramPhotoPost(result.instagramPhotoPost ?? null);

        const next = [url, ...history.filter((h) => h !== url)].slice(0, 10);
        setHistory(next);
        localStorage.setItem(LS_HISTORY, JSON.stringify(next));
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : '요약 생성 중 오류가 발생했습니다. 다시 시도해주세요.'
        );
      }
    });
  }

  const canSubmit = !!apiKey && !!url && !isPending && selectedPlatforms.size > 0;
  const hasResults = (summaries && Object.keys(summaries).length > 0) || instagramPost || instagramPhotoPost;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#f5f0e8' }}>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6 overflow-hidden">

        {/* 헤더 */}
        <div className="text-center space-y-3 pt-2">
          <img
            src="/social-summary-title.png"
            alt="Social Summary"
            className="mx-auto w-[280px] sm:w-[360px]"
            draggable={false}
          />
          <p className="text-neutral-500 text-xs sm:text-sm uppercase tracking-[0.2em]">
            URL을 입력하면 SNS 요약문을 자동으로 생성합니다
          </p>
        </div>

        {/* AI 설정 */}
        <ApiKeyInput
          provider={provider}
          apiKey={apiKey}
          onProviderChange={handleProviderChange}
          onApiKeyChange={handleApiKeyChange}
        />

        {/* URL 입력 폼 */}
        <div className="border-2 border-neutral-900 p-4 sm:p-5 space-y-4" style={{ background: '#faf6ee' }}>
          <label className="block text-sm font-bold uppercase tracking-wider text-neutral-900">
            ★ URL
          </label>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
              className="w-full border-2 border-neutral-900 px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 transition"
              style={{ background: '#f5f0e8' }}
            />

            {history.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {history.slice(0, 5).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setUrl(h)}
                    className="text-xs px-3 py-1.5 border border-neutral-400 text-neutral-600 hover:bg-neutral-900 hover:text-amber-50 truncate max-w-[200px] transition-colors"
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}

            {/* 플랫폼 선택 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-neutral-900">생성할 플랫폼</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPlatforms(
                      selectedPlatforms.size === ALL_PLATFORMS.length
                        ? new Set([ALL_PLATFORMS[0]])
                        : new Set(ALL_PLATFORMS)
                    )
                  }
                  className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2 transition-colors"
                >
                  {selectedPlatforms.size === ALL_PLATFORMS.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((platform) => {
                  const isSelected = selectedPlatforms.has(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      className={`px-3 py-1.5 text-sm font-bold border-2 transition-all active:scale-95 uppercase tracking-wide ${
                        isSelected
                          ? PLATFORM_SELECTED_STYLE[platform]
                          : `border-neutral-300 text-neutral-400 ${PLATFORM_HOVER_STYLE[platform]}`
                      }`}
                      style={!isSelected ? { background: '#faf6ee' } : undefined}
                    >
                      {PLATFORM_LABELS_ALL[platform]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Instagram w/photo 추가 키 */}
            {selectedPlatforms.has('instagramPhoto') && (
              <div className="space-y-3 border-2 border-dashed border-neutral-400 p-4" style={{ background: '#f5f0e8' }}>
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-700">✦ Instagram w/photo 추가 설정</p>
                <div className="space-y-2">
                  <input
                    type="password"
                    value={unsplashKey}
                    onChange={(e) => handleUnsplashKeyChange(e.target.value)}
                    placeholder="Unsplash Access Key"
                    className="w-full border border-neutral-400 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1"
                    style={{ background: '#faf6ee' }}
                  />
                  {provider !== 'openai' && (
                    <input
                      type="password"
                      value={openaiImageKey}
                      onChange={(e) => handleOpenaiImageKeyChange(e.target.value)}
                      placeholder="OpenAI API Key (이미지 생성용)"
                      className="w-full border border-neutral-400 px-3 py-2 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1"
                      style={{ background: '#faf6ee' }}
                    />
                  )}
                </div>
                <p className="text-xs text-neutral-400">Unsplash/OpenAI 키는 한번 입력하면 자동 저장됩니다</p>
              </div>
            )}

            <button
              type={canSubmit ? 'submit' : 'button'}
              onClick={!canSubmit ? showToast : undefined}
              disabled={isPending}
              className="w-full py-3 sm:py-3.5 border-2 border-neutral-900 bg-neutral-900 text-amber-50 font-bold text-sm sm:text-base uppercase tracking-wider hover:bg-transparent hover:text-neutral-900 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? '✒️ 요약 생성 중...' : '★ 요약 생성하기'}
            </button>
          </form>
        </div>

        {/* 토스트 */}
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 border-2 border-neutral-900 bg-neutral-900 text-amber-50 text-sm font-bold shadow-lg transition-all duration-300 max-w-[90vw] text-center ${
            toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          ✦ 생성할 플랫폼을 하나 이상 선택해주세요
        </div>

        {/* 로딩 앵커 */}
        <div ref={loadingRef} />

        {/* 로딩 */}
        {isPending && (
          <div className="text-center py-10 space-y-3">
            <div className="text-3xl animate-bounce">✒️</div>
            <p className="text-neutral-500 text-sm sm:text-base animate-pulse uppercase tracking-wider">
              페이지를 읽고 요약 중입니다...
            </p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="border-2 border-neutral-900 px-4 py-4 text-sm sm:text-base text-neutral-900 flex gap-2 min-w-0" style={{ background: '#faf6ee' }}>
            <span className="shrink-0">⚠</span>
            <span className="break-words min-w-0">{error}</span>
          </div>
        )}

        {/* 요약 결과 */}
        {hasResults && (
          <div className="space-y-4">
            {(['twitter', 'thread', 'linkedin', 'geekNews'] as const)
              .filter((p) => submittedPlatforms.has(p) && summaries?.[p])
              .map((platform) => (
                <SummaryCard key={platform} platform={platform} text={summaries![platform]!} />
              ))}
            {submittedPlatforms.has('instagram') && instagramPost && <InstagramCard post={instagramPost} />}
            {submittedPlatforms.has('instagramPhoto') && instagramPhotoPost && (
              <InstagramPhotoCard
                post={instagramPhotoPost}
                onImageChange={handleSlideImageChange}
                onRegenerateImage={handleRegenerateImage}
                isRegenerating={isRegeneratingImage}
                imageError={imageError}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
