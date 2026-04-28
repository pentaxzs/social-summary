'use client';

import { useState, useEffect, useTransition } from 'react';
import { ApiKeyInput } from '@/components/ApiKeyInput';
import { SummaryCard } from '@/components/SummaryCard';
import { summarizeUrl } from '@/app/actions/summarize';
import { Provider, PlatformSummaries } from '@/lib/types';

const LS_PROVIDER = 'ss_provider';
const LS_API_KEY = 'ss_api_key';
const LS_HISTORY = 'ss_history';

export default function Home() {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [url, setUrl] = useState('');
  const [summaries, setSummaries] = useState<PlatformSummaries | null>(null);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!apiKey || !url) return;

    setError(null);
    setSummaries(null);

    startTransition(async () => {
      const result = await summarizeUrl(url, provider, apiKey);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSummaries(result.summaries ?? null);

      const next = [url, ...history.filter((h) => h !== url)].slice(0, 10);
      setHistory(next);
      localStorage.setItem(LS_HISTORY, JSON.stringify(next));
    });
  }

  const canSubmit = !!apiKey && !!url && !isPending;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">

        {/* 헤더 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            📣 Social Summary
          </h1>
          <p className="text-gray-500 text-sm sm:text-base">
            URL을 입력하면 SNS 플랫폼별 요약문을 자동으로 생성해드립니다
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
          <form onSubmit={handleSubmit} className="space-y-3">
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

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-3 sm:py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm sm:text-base hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? '✨ 요약 생성 중...' : '요약 생성하기'}
            </button>
          </form>
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
        {summaries && (
          <div className="space-y-4">
            {(['twitter', 'thread', 'linkedin', 'geekNews'] as const).map((platform) => (
              <SummaryCard key={platform} platform={platform} text={summaries[platform]} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
