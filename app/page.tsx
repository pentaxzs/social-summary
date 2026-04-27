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

  // localStorage 불러오기
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

      // 히스토리 저장 (최근 10개)
      const next = [url, ...history.filter((h) => h !== url)].slice(0, 10);
      setHistory(next);
      localStorage.setItem(LS_HISTORY, JSON.stringify(next));
    });
  }

  const canSubmit = !!apiKey && !!url && !isPending;

  return (
    <main className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Social Summary</h1>
        <p className="text-gray-500 text-sm">URL을 입력하면 SNS 플랫폼별 요약문을 생성해드립니다</p>
      </div>

      <ApiKeyInput
        provider={provider}
        apiKey={apiKey}
        onProviderChange={handleProviderChange}
        onApiKeyChange={handleApiKeyChange}
      />

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">🌐 URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 5).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setUrl(h)}
                className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 truncate max-w-[200px]"
              >
                {h}
              </button>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? '요약 생성 중...' : '요약 생성'}
        </button>
      </form>

      {isPending && (
        <div className="text-center py-8 text-gray-500 text-sm animate-pulse">
          페이지를 읽고 요약 중입니다...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {summaries && (
        <div className="space-y-4">
          {(['twitter', 'thread', 'linkedin', 'geekNews'] as const).map((platform) => (
            <SummaryCard key={platform} platform={platform} text={summaries[platform]} />
          ))}
        </div>
      )}
    </main>
  );
}
