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
    <div className="border-2 border-neutral-900 p-4 sm:p-5 space-y-4" style={{ background: '#faf6ee' }}>
      <div>
        <label className="block text-sm font-bold uppercase tracking-wider text-neutral-900 mb-2">
          ✦ AI 제공자
        </label>
        <select
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as Provider)}
          className="w-full border-2 border-neutral-900 px-4 py-3 text-sm sm:text-base text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 transition appearance-none cursor-pointer"
          style={{ background: '#f5f0e8' }}
        >
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
            <option key={p} value={p}>
              {PROVIDERS[p].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-bold uppercase tracking-wider text-neutral-900 mb-2">
          ✦ API Key
        </label>
        <div className="relative">
          <input
            type={visible ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder={config.keyPlaceholder}
            className="w-full border-2 border-neutral-900 px-4 py-3 pr-12 text-sm sm:text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 transition"
            style={{ background: '#f5f0e8' }}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-900 text-lg leading-none p-1"
            aria-label={visible ? 'API 키 숨기기' : 'API 키 보기'}
          >
            {visible ? '🙈' : '👁️'}
          </button>
        </div>
        <p className="mt-2 text-xs sm:text-sm text-neutral-500">
          API 키는{' '}
          <a
            href={config.keyHelpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-900 underline underline-offset-2 hover:no-underline font-medium"
          >
            {config.keyHelpLabel}
          </a>
          에서 확인할 수 있습니다
        </p>
      </div>
    </div>
  );
}
