'use client';

import { useState } from 'react';
import { Provider, PROVIDERS } from '@/lib/types';

interface ApiKeyInputProps {
  provider: Provider;
  apiKey: string;
  onProviderChange: (provider: Provider) => void;
  onApiKeyChange: (key: string) => void;
}

export function ApiKeyInput({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
}: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const config = PROVIDERS[provider];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
      <div>
        <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2">
          🤖 AI 제공자
        </label>
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as Provider)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm sm:text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition"
        >
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-base sm:text-lg font-semibold text-gray-800 mb-2">
          🔑 API Key
        </label>
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={config.keyPlaceholder}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
            aria-label={visible ? 'API 키 숨기기' : 'API 키 보기'}
          >
            {visible ? '🙈' : '👁️'}
          </button>
        </div>
        <p className="mt-2 text-xs sm:text-sm text-gray-500">
          💡 API 키는{' '}
          <a
            href={config.keyHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
          >
            {config.keyHelpLabel}
          </a>
          에서 확인할 수 있습니다
        </p>
      </div>
    </div>
  );
}
