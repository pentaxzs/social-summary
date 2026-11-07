'use client';

import { useState } from 'react';
import { Provider, PROVIDERS } from '@/lib/types';
import { useHydrated } from '@/lib/use-hydrated';
import { KeyField } from '@/components/KeyField';

interface ApiKeyInputProps {
  provider: Provider;
  apiKey: string;
  onProviderChange: (provider: Provider) => void;
  onApiKeyChange: (key: string) => void;
  /** 유튜브 주소를 읽을 때만 쓰지만, 키는 키끼리 모아 둔다 */
  youtubeKey: string;
  onYoutubeKeyChange: (key: string) => void;
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
  youtubeKey,
  onYoutubeKeyChange,
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
        className="flex items-start gap-2.5 w-full py-2 border-b border-[var(--hair)] text-[11px] tracking-[0.1em] uppercase text-left"
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 mt-[5px]"
          style={{ background: hydrated && apiKey ? '#2d6a44' : '#a8541c' }}
        />
        {/* 접힌 상태에서도 이 안에 무엇이 들어있는지 보여야 한다.
            유튜브 키를 여기 넣을 수 있다는 걸 알 길이 없었다 */}
        <span className="min-w-0 leading-snug">
          {config.label}
          <span className="text-[var(--soft)] normal-case tracking-normal">
            {' · '}
            <span className="whitespace-nowrap">
              {hydrated && apiKey ? 'API 키 설정됨' : 'API 키 필요'}
            </span>
            {' · '}
            <span className="whitespace-nowrap">
              {hydrated && youtubeKey ? 'YouTube 키 설정됨' : 'YouTube 키 없음'}
            </span>
          </span>
        </span>
        <span className="ml-auto shrink-0 text-[var(--soft)] mt-[1px]">{expanded ? '접기 ▴' : '변경 ▾'}</span>
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
            <label htmlFor="ai-api-key" className="np-label np-label-latin block mb-2">
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

          <div className="pt-3.5 border-t border-dashed border-[var(--hair)]">
            <KeyField
              label="YouTube Data API Key"
              value={youtubeKey}
              onChange={onYoutubeKeyChange}
              hint="유튜브 영상을 요약할 때만 씁니다. 유튜브가 서버에서 온 요청을 막기 때문에 이 키가 있어야 영상 정보를 읽습니다"
            />
            <p className="mt-1.5 text-[11px] text-[var(--soft)]">
              무료입니다. Google Cloud 콘솔에서{' '}
              <a
                href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--ink)] underline underline-offset-2 hover:no-underline font-medium"
              >
                YouTube Data API v3
              </a>
              {' '}를 켜면 발급됩니다. 자막은 받아올 수 없어 제목·채널·태그와 설명란까지만 읽습니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
