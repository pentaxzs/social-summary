'use client';

import { useState } from 'react';
import { Provider, PROVIDERS } from '@/lib/types';
import { useHydrated } from '@/lib/use-hydrated';

interface ApiKeyInputProps {
  provider: Provider;
  apiKey: string;
  onProviderChange: (provider: Provider) => void;
  onApiKeyChange: (key: string) => void;
}

/**
 * 키가 이미 저장돼 있으면 한 줄로 접어둔다. 이 화면의 주인공은 URL 입력이고
 * 키 설정은 처음 한 번만 필요한 일이라 매번 같은 자리를 차지할 이유가 없다.
 */
export function ApiKeyInput({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
}: ApiKeyInputProps) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const config = PROVIDERS[provider];

  // localStorage 복원은 마운트 후에 일어나므로, 그 전에는 펼침 여부를 판단하지 않는다
  const hydrated = useHydrated();

  const expanded = open || (hydrated && !apiKey);

  return (
    <div className="mt-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex items-center gap-2.5 w-full py-2 border-b border-[var(--hair)] text-[11px] tracking-[0.1em] uppercase text-left"
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: hydrated && apiKey ? '#2d6a44' : '#a8541c' }}
        />
        <span className="min-w-0 truncate">
          {config.label}
          <span className="text-[var(--soft)] normal-case tracking-normal">
            {' · '}
            {hydrated && apiKey ? 'API 키 설정됨' : 'API 키 필요'}
          </span>
        </span>
        <span className="ml-auto shrink-0 text-[var(--soft)]">{expanded ? '접기 ▴' : '변경 ▾'}</span>
      </button>

      {expanded && (
        <div className="py-4 space-y-3.5 border-b border-[var(--hair)]">
          <div>
            <label htmlFor="ai-provider" className="np-label block mb-2">
              AI 제공자
            </label>
            <select
              id="ai-provider"
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as Provider)}
              className="w-full border-2 border-[var(--ink)] px-3.5 py-2.5 text-base bg-[var(--card)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-2 appearance-none cursor-pointer"
            >
              {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDERS[p].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ai-api-key" className="np-label block mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                id="ai-api-key"
                type={visible ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder={config.keyPlaceholder}
                className="w-full border-2 border-[var(--ink)] px-3.5 py-2.5 pr-12 text-base bg-[var(--card)] placeholder:text-[var(--faint)] focus:outline-none focus:ring-2 focus:ring-[var(--ink)] focus:ring-offset-2"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--soft)] hover:text-[var(--ink)] text-lg leading-none p-1"
                aria-label={visible ? 'API 키 숨기기' : 'API 키 보기'}
              >
                {visible ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--soft)]">
              API 키는{' '}
              <a
                href={config.keyHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--ink)] underline underline-offset-2 hover:no-underline font-medium"
              >
                {config.keyHelpLabel}
              </a>
              에서 확인할 수 있습니다. 브라우저에만 저장되고 서버에 남지 않습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
