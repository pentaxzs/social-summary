'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { ApiKeyInput } from '@/components/ApiKeyInput';
import { SummaryCard } from '@/components/SummaryCard';
import { SummarySkeleton } from '@/components/SummarySkeleton';
import { InstagramCard } from '@/components/InstagramCard';
import { InstagramPhotoCard } from '@/components/InstagramPhotoCard';
import { summarizeUrl, regenerateSummary, regenerateInstagramPost } from '@/app/actions/summarize';
import { regenerateSlideImage, checkImageModels } from '@/app/actions/image-sources';
import { KeyField } from '@/components/KeyField';
import { CardCountPicker } from '@/components/CardCountPicker';
import {
  Provider,
  Platform,
  TextPlatform,
  PlatformSummaries,
  InstagramPost,
  InstagramPhotoPost,
  SourceDoc,
  RegenerateMode,
  ALL_PLATFORMS,
  PLATFORM_META,
  PROVIDERS,
  TEXT_PLATFORMS,
  DEFAULT_CARD_COUNT,
} from '@/lib/types';

const LS_PROVIDER = 'ss_provider';
const LS_API_KEY = 'ss_api_key';
const LS_HISTORY = 'ss_history';
const LS_UNSPLASH_KEY = 'ss_unsplash_key';
const LS_OPENAI_IMAGE_KEY = 'ss_openai_image_key';
const LS_YOUTUBE_KEY = 'ss_youtube_key';


/** 요청은 끝났는데 결과가 없는 플랫폼. 조용히 사라지지 않고 왜 비었는지 알린다 */
function FailedCard({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform];
  return (
    <div className="pb-5 border-b border-[var(--hair)]">
      <div className="flex items-baseline gap-2.5 mb-3">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] shrink-0" style={{ color: meta.color }}>
          {meta.no} · {meta.label}
        </span>
        <span className="flex-1 h-0.5 opacity-30 min-w-4" style={{ background: meta.color }} />
      </div>
      <p className="pl-3.5 border-l-[3px] text-[15px] text-[var(--soft)]" style={{ borderColor: meta.color }}>
        이 플랫폼은 만들지 못했습니다. 다시 생성해보세요.
      </p>
    </div>
  );
}

export default function Home() {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [url, setUrl] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set());
  const [toast, setToast] = useState(false);
  const [summaries, setSummaries] = useState<Partial<PlatformSummaries> | null>(null);
  const [instagramPost, setInstagramPost] = useState<InstagramPost | null>(null);
  const [instagramPhotoPost, setInstagramPhotoPost] = useState<InstagramPhotoPost | null>(null);
  const [unsplashKey, setUnsplashKey] = useState('');
  const [openaiImageKey, setOpenaiImageKey] = useState('');
  const [imageModelMsg, setImageModelMsg] = useState<string | null>(null);
  const [youtubeKey, setYoutubeKey] = useState('');
  const urlRef = useRef<HTMLInputElement>(null);
  const [cardCount, setCardCount] = useState(DEFAULT_CARD_COUNT);
  const [deckBusy, setDeckBusy] = useState<'instagram' | 'instagramPhoto' | null>(null);
  const [deckError, setDeckError] = useState<Partial<Record<'instagram' | 'instagramPhoto', string>>>({});
  const [submittedPlatforms, setSubmittedPlatforms] = useState<Set<Platform>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const resultsRef = useRef<HTMLDivElement>(null);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // 카드 단위 재생성 상태
  const [source, setSource] = useState<SourceDoc | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [previous, setPrevious] = useState<Partial<PlatformSummaries>>({});
  const [busyPlatform, setBusyPlatform] = useState<TextPlatform | null>(null);
  const [cardError, setCardError] = useState<Partial<Record<TextPlatform, string>>>({});

  useEffect(() => {
    if (isPending && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isPending]);

  // localStorage 는 서버에 없으므로 복원은 마운트 이후여야 한다. 초기값으로
  // 당겨오면 서버/클라이언트 첫 렌더가 갈려 하이드레이션 불일치가 생긴다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const read = (k: string) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null; // 프라이빗 모드 등에서 접근이 막힐 수 있다
      }
    };
    const savedProvider = read(LS_PROVIDER) as Provider | null;
    const savedKey = read(LS_API_KEY);
    const savedHistory = read(LS_HISTORY);
    const savedUnsplashKey = read(LS_UNSPLASH_KEY);
    const savedOpenaiImageKey = read(LS_OPENAI_IMAGE_KEY);
    const savedYoutubeKey = read(LS_YOUTUBE_KEY);

    if (savedProvider) setProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setHistory(parsed);
      } catch {
        /* 깨진 기록은 버린다 */
      }
    }
    if (savedUnsplashKey) setUnsplashKey(savedUnsplashKey);
    if (savedOpenaiImageKey) setOpenaiImageKey(savedOpenaiImageKey);
    if (savedYoutubeKey) setYoutubeKey(savedYoutubeKey);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  /** 이 키로 어떤 이미지 모델을 쓸 수 있는지 미리 알려준다 */
  async function checkImageKey() {
    const key = provider === 'openai' ? apiKey : openaiImageKey;
    if (!key) {
      setImageModelMsg('OpenAI 키를 먼저 넣어주세요');
      return;
    }
    setImageModelMsg('확인 중…');
    try {
      setImageModelMsg((await checkImageModels(key)).message);
    } catch {
      setImageModelMsg('확인하지 못했습니다');
    }
  }

  function handleOpenaiImageKeyChange(key: string) {
    setOpenaiImageKey(key);
    localStorage.setItem(LS_OPENAI_IMAGE_KEY, key);
  }

  function handleYoutubeKeyChange(key: string) {
    setYoutubeKey(key);
    localStorage.setItem(LS_YOUTUBE_KEY, key);
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

  async function handleRegenerateImage(slideIndex: number, imageSource: 'unsplash' | 'gpt') {
    if (!instagramPhotoPost) return;
    const slide = instagramPhotoPost.slides[slideIndex];
    if (!slide) return;

    setIsRegeneratingImage(true);
    setImageError(null);
    try {
      const effectiveOpenaiKey = provider === 'openai' ? apiKey : openaiImageKey;
      const result = await regenerateSlideImage(
        imageSource, slide.headline, slide.keyword,
        unsplashKey || undefined,
        effectiveOpenaiKey || undefined,
        // Unsplash 중복만 걸러내면 되므로 http 주소만 보낸다.
        // AI 생성·직접 올린 사진은 data URI 라 그대로 실어 보내면
        // 서버 액션 본문 1MB 제한에 걸려 요청 자체가 죽는다
        instagramPhotoPost.slides
          .map((x) => x.image_url)
          .filter((u) => u.startsWith('http')),
      );
      if (result.url) {
        handleSlideImageChange(slideIndex, result.url);
      } else {
        setImageError(result.error || '이미지를 가져오지 못했습니다');
      }
    } catch {
      setImageError('이미지 생성 중 오류가 발생했습니다');
    } finally {
      setIsRegeneratingImage(false);
    }
  }

  /** 카드 묶음을 고른 장수로 다시 만든다 */
  async function handleDeckRegenerate(
    kind: 'instagram' | 'instagramPhoto',
    cardCount: number,
  ) {
    if (!source || !apiKey || deckBusy) return;
    setDeckBusy(kind);
    setDeckError((prev) => ({ ...prev, [kind]: undefined }));
    try {
      const result = await regenerateInstagramPost(
        kind, source, cardCount, provider, apiKey,
        unsplashKey || undefined,
        provider === 'openai' ? apiKey : openaiImageKey || undefined,
      );
      if (result.error) {
        setDeckError((prev) => ({ ...prev, [kind]: result.error }));
        return;
      }
      if (kind === 'instagram' && result.post) setInstagramPost(result.post);
      if (kind === 'instagramPhoto' && result.photoPost) setInstagramPhotoPost(result.photoPost);
    } catch {
      setDeckError((prev) => ({ ...prev, [kind]: '다시 만드는 중 오류가 발생했습니다' }));
    } finally {
      setDeckBusy(null);
    }
  }

  /** 카드 하나만 다시 만든다. 원문은 첫 생성 때 받아둔 걸 재사용한다 */
  async function handleCardRegenerate(platform: TextPlatform, mode: RegenerateMode) {
    if (!source || !apiKey || busyPlatform) return;
    const current = summaries?.[platform];
    if (!current) return;

    setBusyPlatform(platform);
    setCardError((prev) => ({ ...prev, [platform]: undefined }));
    try {
      const result = await regenerateSummary(platform, mode, source, sourceUrl, provider, apiKey);
      if (result.error || !result.text) {
        setCardError((prev) => ({ ...prev, [platform]: result.error || '다시 만들지 못했습니다' }));
        return;
      }
      setPrevious((prev) => ({ ...prev, [platform]: current }));
      setSummaries((prev) => ({ ...prev, [platform]: result.text }));
    } catch {
      setCardError((prev) => ({ ...prev, [platform]: '다시 만드는 중 오류가 발생했습니다' }));
    } finally {
      setBusyPlatform(null);
    }
  }

  function handleCardUndo(platform: TextPlatform) {
    const prevText = previous[platform];
    if (!prevText) return;
    setSummaries((prev) => ({ ...prev, [platform]: prevText }));
    setPrevious((prev) => ({ ...prev, [platform]: undefined }));
    setCardError((prev) => ({ ...prev, [platform]: undefined }));
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
    setPrevious({});
    setCardError({});
    setSource(null);

    const platformsSnapshot = new Set(selectedPlatforms);
    setSubmittedPlatforms(platformsSnapshot);
    const submittedUrl = url;

    startTransition(async () => {
      try {
        const result = await summarizeUrl(
          submittedUrl, provider, apiKey, Array.from(platformsSnapshot),
          unsplashKey || undefined,
          provider === 'openai' ? apiKey : openaiImageKey || undefined,
          youtubeKey || undefined,
          cardCount,
        );

        if ('error' in result && result.error) {
          setError(result.error);
          return;
        }

        setSummaries(result.summaries ?? null);
        setInstagramPost(result.instagramPost ?? null);
        setInstagramPhotoPost(result.instagramPhotoPost ?? null);
        setSource(result.source ?? null);
        setSourceUrl(submittedUrl);

        const next = [submittedUrl, ...history.filter((h) => h !== submittedUrl)].slice(0, 10);
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
  const resultCount = submittedPlatforms.size;

  return (
    <main className="max-w-[700px] mx-auto px-4 pt-6 pb-20">

      {/* 제호 */}
      <header className="border-t-[5px] border-b border-[var(--ink)] pt-4 pb-2.5 text-center">
        <h1 className="text-[34px] sm:text-[46px] font-black tracking-[-0.5px] leading-[0.95]">
          SOCIAL SUMMARY
        </h1>
        <p className="np-label mt-3">URL을 입력하면 SNS 요약문을 자동으로 생성합니다</p>
      </header>

      <ApiKeyInput
        provider={provider}
        apiKey={apiKey}
        onProviderChange={handleProviderChange}
        onApiKeyChange={handleApiKeyChange}
        youtubeKey={youtubeKey}
        onYoutubeKeyChange={handleYoutubeKeyChange}
      />

      {/* 입력 */}
      <form onSubmit={handleSubmit} className="mt-5">
        <label htmlFor="article-url" className="np-label block border-b-2 border-[var(--ink)] pb-1.5 mb-3">
          요약할 글 주소
        </label>
        {/* 긴 주소를 지우려면 전체 선택부터 해야 했다. 값이 있을 때만 지우기 단추를 둔다 */}
        <div className="relative border-b-2 border-[var(--ink)] focus-within:border-b-[3px]">
          <input
            ref={urlRef}
            id="article-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            required
            className="w-full border-0 bg-transparent pt-2 pb-3 pl-0.5 pr-11 text-lg sm:text-[21px] tracking-[-0.2px] placeholder:text-[var(--faint)] focus:outline-none"
          />
          {url && (
            <button
              type="button"
              onClick={() => { setUrl(''); urlRef.current?.focus(); }}
              aria-label="주소 지우기"
              className="absolute right-0 bottom-3 w-8 h-8 flex items-center justify-center rounded-full text-[var(--soft)] hover:text-[var(--ink)] hover:bg-[var(--hair)]/60 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden>
                <path d="M2 2 L13 13 M13 2 L2 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
            {history.slice(0, 4).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setUrl(h)}
                className="text-[11px] text-[var(--soft)] underline underline-offset-2 hover:text-[var(--ink)] truncate max-w-[210px]"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        {/* 플랫폼 = 지면 섹션 */}
        <div className="flex items-baseline justify-between border-b-2 border-[var(--ink)] pb-1.5 mt-6 mb-2.5">
          <span className="np-label">생성할 플랫폼</span>
          <button
            type="button"
            onClick={() =>
              setSelectedPlatforms(
                selectedPlatforms.size === ALL_PLATFORMS.length
                  ? new Set<Platform>()
                  : new Set(ALL_PLATFORMS)
              )
            }
            className="np-label underline underline-offset-[3px] hover:text-[var(--ink)]"
          >
            {selectedPlatforms.size === ALL_PLATFORMS.length ? '전체 해제' : '전체 선택'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 border-t border-l border-[var(--hair)]">
          {ALL_PLATFORMS.map((platform) => {
            const meta = PLATFORM_META[platform];
            const isSelected = selectedPlatforms.has(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                aria-pressed={isSelected}
                className={`relative text-left px-3 py-3 border-r border-b border-[var(--hair)] transition-colors ${
                  isSelected ? 'bg-[var(--card)]' : 'hover:bg-[var(--card)]/60'
                }`}
              >
                <span
                  className="block text-[10px] tracking-[0.2em] mb-1.5"
                  style={{ color: isSelected ? meta.color : 'var(--faint)' }}
                >
                  {meta.no}
                </span>
                <span
                  className="block text-sm font-bold truncate"
                  style={{ color: isSelected ? meta.color : 'var(--ink)' }}
                >
                  {meta.label}
                </span>
                <span
                  className="block h-[3px] mt-1.5 transition-all"
                  style={{
                    background: isSelected ? meta.color : '#d5cab3',
                    width: isSelected ? '100%' : '24px',
                  }}
                />
                {isSelected && (
                  <span className="absolute top-2 right-2.5 text-xs font-black" style={{ color: meta.color }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
          {/* 마지막 줄 끝을 막는 빈 칸. 7개라 2열에서는 하나, 3열에서는 둘이 빈다 */}
          <span aria-hidden className="border-r border-b border-[var(--hair)]" />
          <span aria-hidden className="hidden sm:block border-r border-b border-[var(--hair)]" />
        </div>

        {/* Instagram w/photo 추가 키 */}
        {selectedPlatforms.has('instagramPhoto') && (
          <div className="mt-4 p-4 border border-dashed border-[var(--hair)] space-y-3 bg-[var(--card)]">
            <p className="np-label">사진 카드 추가 설정</p>

            <KeyField
              label="Unsplash Access Key"
              value={unsplashKey}
              onChange={handleUnsplashKeyChange}
              hint="사진을 검색해 옵니다. 없으면 사진 없이 만들어집니다"
            />

            {provider !== 'openai' && (
              <KeyField
                label="OpenAI API Key"
                value={openaiImageKey}
                onChange={handleOpenaiImageKeyChange}
                hint={`AI 이미지 생성과 영문 검색어에 씁니다. ${PROVIDERS[provider].label} 키로는 이미지를 만들 수 없습니다`}
              />
            )}
            {provider === 'openai' && (
              <p className="text-[11px] text-[var(--soft)]">
                이미지에는 위에 넣은 OpenAI 키를 함께 씁니다
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              <button
                type="button"
                onClick={checkImageKey}
                className="text-[11px] font-bold uppercase tracking-[0.12em] underline underline-offset-4 hover:no-underline"
              >
                이미지 모델 확인
              </button>
              {imageModelMsg && (
                <span className="text-[11px] text-[var(--soft)] break-words min-w-0">
                  {imageModelMsg}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 만들기 전에 정한다. 원문 길이를 보고 몇 장이 맞을지 판단하는 편이 낫다 */}
        {(selectedPlatforms.has('instagram') || selectedPlatforms.has('instagramPhoto')) && (
          <div className="mt-4">
            <CardCountPicker
              label="카드 장수"
              value={cardCount}
              onChange={setCardCount}
              color={PLATFORM_META.instagram.color}
            />
            <p className="mt-1.5 text-[11px] text-[var(--soft)]">
              표지와 마무리 장을 포함한 수입니다. 만든 뒤에도 카드에서 다시 고를 수 있습니다
            </p>
          </div>
        )}

        <button
          type={canSubmit ? 'submit' : 'button'}
          onClick={!canSubmit ? showToast : undefined}
          disabled={isPending}
          className="w-full mt-5 border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--card)] py-3.5 text-[13px] font-bold uppercase tracking-[0.2em] hover:bg-transparent hover:text-[var(--ink)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? '만드는 중…' : '요약 생성하기'}
        </button>
      </form>

      {/* 토스트 */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--card)] text-sm font-bold max-w-[90vw] text-center transition-all duration-300 ${
          toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        생성할 플랫폼을 하나 이상 선택해주세요
      </div>

      <div ref={resultsRef} />

      {error && (
        <div className="mt-8 border-l-[3px] border-[#8a2a12] pl-3.5 py-2 flex gap-2 min-w-0">
          <span className="shrink-0">⚠</span>
          <span className="break-words min-w-0 text-sm">{error}</span>
        </div>
      )}

      {/* 결과 */}
      {(isPending || hasResults) && !error && (
        <section className="mt-10">
          <h2 className="np-label border-t-[5px] border-[var(--ink)] pt-1.5">
            생성 결과{resultCount > 0 && ` · ${resultCount}개`}
          </h2>

          <div className="mt-5 space-y-5">
            {TEXT_PLATFORMS.filter((p) => submittedPlatforms.has(p)).map((platform) => {
              if (summaries?.[platform]) {
                return (
                  <SummaryCard
                    key={platform}
                    platform={platform}
                    text={summaries[platform]!}
                    previous={previous[platform]}
                    busy={busyPlatform === platform}
                    error={cardError[platform] ?? null}
                    onRegenerate={handleCardRegenerate}
                    onUndo={handleCardUndo}
                  />
                );
              }
              // 요청이 끝났는데 결과가 없으면 그 플랫폼은 실패한 것이다.
              // 스켈레톤을 남겨두면 영원히 생성 중인 것처럼 보인다.
              return isPending ? <SummarySkeleton key={platform} platform={platform} /> : null;
            })}

            {submittedPlatforms.has('instagram') &&
              (instagramPost ? (
                <InstagramCard
                  post={instagramPost}
                  onRegenerate={(n) => handleDeckRegenerate('instagram', n)}
                  regenerating={deckBusy === 'instagram'}
                  regenerateError={deckError.instagram ?? null}
                />
              ) : isPending ? (
                <SummarySkeleton platform="instagram" />
              ) : (
                <FailedCard platform="instagram" />
              ))}

            {submittedPlatforms.has('instagramPhoto') &&
              (instagramPhotoPost ? (
                <InstagramPhotoCard
                  post={instagramPhotoPost}
                  onImageChange={handleSlideImageChange}
                  onRegenerateImage={handleRegenerateImage}
                  isRegenerating={isRegeneratingImage}
                  imageError={imageError}
                  onRegenerate={(n) => handleDeckRegenerate('instagramPhoto', n)}
                  regenerating={deckBusy === 'instagramPhoto'}
                  regenerateError={deckError.instagramPhoto ?? null}
                />
              ) : isPending ? (
                <SummarySkeleton platform="instagramPhoto" />
              ) : (
                <FailedCard platform="instagramPhoto" />
              ))}
          </div>
        </section>
      )}
    </main>
  );
}
