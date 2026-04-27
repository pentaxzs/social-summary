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
    <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          AI 제공자
        </label>
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as Provider)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          🔑 API Key
        </label>
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={config.keyPlaceholder}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
          >
            {visible ? '🙈' : '👁️'}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          💡 API 키는{' '}
          <a
            href={config.keyHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 underline"
          >
            {config.keyHelpLabel}
          </a>
          에서 확인할 수 있습니다
        </p>
      </div>
    </div>
  );
}
