'use client';

import { useState, useEffect, useTransition } from 'react';
import { ApiKeyInput } from '@/components/ApiKeyInput';
import { SummaryCard } from '@/components/SummaryCard';
import { InstagramCard } from '@/components/InstagramCard';
import { summarizeUrl } from '@/app/actions/summarize';
import {
  Provider,
  Platform,
  PlatformSummaries,
  InstagramPost,
  ALL_PLATFORMS,
  PLATFORM_LABELS_ALL,
} from '@/lib/types';

const LS_PROVIDER = 'ss_provider';
const LS_API_KEY = 'ss_api_key';
const LS_HISTORY = 'ss_history';

const PLATFORM_SELECTED_STYLE: Record<Platform, string> = {
  twitter:   'bg-sky-500   border-sky-500   text-white',
  thread:    'bg-gray-700  border-gray-700  text-white',
  linkedin:  'bg-blue-700  border-blue-700  text-white',
  geekNews:  'bg-pink-500  border-pink-500  text-white',
  instagram: 'bg-fuchsia-600 border-fuchsia-600 text-white',
};

const PLATFORM_HOVER_STYLE: Record<Platform, string> = {
  twitter:   'hover:border-sky-300   hover:text-sky-600',
  thread:    'hover:border-gray-400  hover:text-gray-700',
  linkedin:  'hover:border-blue-400  hover:text-blue-700',
  geekNews:  'hover:border-pink-400  hover:text-pink-600',
  instagram: 'hover:border-fuchsia-400 hover:text-fuchsia-600',
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
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const savedProvider = localStorage.getItem(LS_PROVIDER) as Provider | null;
    const savedKey = localStorage.getItem(LS_API_KEY);
    const savedHistory = localStorage.getItem(LS_HISTORY);
    if (savedProvider) setProvider(savedProvider);
    if (savedKey) setApiKey(savedKey);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  function handleProviderChange(p: Provider) {
    setProvider(p);
    localStorage.setItem(LS_PROVIDER, p);
  }

  function handleApiKeyChange(key: string) {
    setApiKey(key);
    localStorage.setItem(LS_API_KEY, key);
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

    startTransition(async () => {
      try {
        const result = await summarizeUrl(url, provider, apiKey, Array.from(selectedPlatforms));

        if (result.error) {
          setError(result.error);
          return;
        }

        setSummaries(result.summaries ?? null);
        setInstagramPost(result.instagramPost ?? null);

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
  const hasResults = (summaries && Object.keys(summaries).length > 0) || instagramPost;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">

        {/* 헤더 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            📣 Social Summary
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">
            URL을 입력하면 SNS 요약문을 자동으로 생성해요.
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
          <label className="block text-base sm:text-lg font-semibold text-gray-800">
            🌐 URL
          </label>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />

            {history.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {history.slice(0, 5).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setUrl(h)}
                    className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 truncate max-w-[200px] transition-colors"
                  >
                    {h}
                  </button>
                ))}
              </div>
            )}

            {/* 플랫폼 선택 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">생성할 플랫폼</span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPlatforms(
                      selectedPlatforms.size === ALL_PLATFORMS.length
                        ? new Set([ALL_PLATFORMS[0]])
                        : new Set(ALL_PLATFORMS)
                    )
                  }
                  className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
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
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                        isSelected
                          ? PLATFORM_SELECTED_STYLE[platform]
                          : `bg-white border-gray-200 text-gray-400 ${PLATFORM_HOVER_STYLE[platform]}`
                      }`}
                    >
                      {PLATFORM_LABELS_ALL[platform]}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type={canSubmit ? 'submit' : 'button'}
              onClick={!canSubmit ? showToast : undefined}
              disabled={isPending}
              className="w-full py-3 sm:py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm sm:text-base hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? '✨ 요약 생성 중...' : '요약 생성하기'}
            </button>
          </form>
        </div>

        {/* 토스트 */}
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-gray-900 text-white text-sm font-medium shadow-lg transition-all duration-300 whitespace-nowrap ${
            toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          📌 생성할 플랫폼을 하나 이상 선택해주세요
        </div>

        {/* 로딩 */}
        {isPending && (
          <div className="text-center py-10 space-y-3">
            <div className="text-3xl animate-bounce">✨</div>
            <p className="text-gray-500 text-sm sm:text-base animate-pulse">
              페이지를 읽고 요약 중입니다...
            </p>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm sm:text-base text-red-700 flex gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* 요약 결과 */}
        {hasResults && (
          <div className="space-y-4">
            {(['twitter', 'thread', 'linkedin', 'geekNews'] as const)
              .filter((p) => summaries?.[p])
              .map((platform) => (
                <SummaryCard key={platform} platform={platform} text={summaries![platform]!} />
              ))}
            {instagramPost && <InstagramCard post={instagramPost} />}
          </div>
        )}
      </main>
    </div>
  );
}
