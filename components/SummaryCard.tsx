'use client';

import { useEffect, useRef, useState } from 'react';
import {
  PLATFORM_LIMITS,
  PLATFORM_META,
  TONES,
  PlatformSummaries,
  RegenerateMode,
} from '@/lib/types';

interface SummaryCardProps {
  platform: keyof PlatformSummaries;
  text: string;
  /** 직전 버전. 있으면 되돌리기 링크를 띄운다 */
  previous?: string;
  busy?: boolean;
  error?: string | null;
  onRegenerate: (platform: keyof PlatformSummaries, mode: RegenerateMode) => void;
  onUndo: (platform: keyof PlatformSummaries) => void;
}

export function SummaryCard({
  platform,
  text,
  previous,
  busy = false,
  error = null,
  onRegenerate,
  onUndo,
}: SummaryCardProps) {
  const [copied, setCopied] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const toneRef = useRef<HTMLDivElement>(null);

  const meta = PLATFORM_META[platform];
  const limit = PLATFORM_LIMITS[platform];
  const count = text.length;
  // Reddit 은 길이를 단어로 센다. 본문 word count 는 결과 안에 적혀 나오므로
  // 여기서 글자 수 상한을 들이대면 지켜야 할 기준인 양 보인다
  const showsLimit = platform !== 'reddit';
  const over = showsLimit && count > limit;

  useEffect(() => {
    if (!toneOpen) return;
    function onDocPointerDown(e: MouseEvent) {
      if (toneRef.current && !toneRef.current.contains(e.target as Node)) setToneOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setToneOpen(false);
    }
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [toneOpen]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드 권한이 없으면 조용히 넘어간다 */
    }
  }

  function fire(mode: RegenerateMode) {
    setToneOpen(false);
    onRegenerate(platform, mode);
  }

  const actionClass =
    'text-[11px] font-bold uppercase tracking-[0.12em] underline underline-offset-4 ' +
    'hover:no-underline disabled:opacity-35 disabled:cursor-not-allowed transition';

  return (
    <article className="pb-5 border-b border-[var(--hair)]" style={{ ['--c' as string]: meta.color }}>
      {/* 기사 헤더: 섹션 번호 · 플랫폼 · 글자 수 */}
      <div className="flex items-baseline gap-2.5 mb-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] shrink-0" style={{ color: meta.color }}>
          {meta.no} · {meta.label}
        </h3>
        <span className="flex-1 h-0.5 opacity-30 min-w-4" style={{ background: meta.color }} />
        <span
          className={`text-[11px] tracking-wider tabular-nums shrink-0 ${
            over ? 'font-bold text-[#8a2a12]' : 'text-[var(--soft)]'
          }`}
        >
          {showsLimit
            ? `${count.toLocaleString()} / ${limit.toLocaleString()}자`
            : `${count.toLocaleString()}자`}
        </span>
      </div>

      {/* 본문 — 플랫폼 색 세로 괘선 */}
      <div className="pl-3.5 border-l-[3px] min-w-0" style={{ borderColor: meta.color }}>
        <p
          className={`text-[15px] leading-[1.8] whitespace-pre-wrap break-words transition-opacity ${
            busy ? 'opacity-40' : ''
          }`}
        >
          {text}
        </p>

        {error && (
          <p className="mt-3 text-xs text-[#8a2a12] break-words">⚠ {error}</p>
        )}

        {/* 액션 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3.5 pt-2.5 border-t border-[var(--hair)]">
          {/* 가장 많이 쓰는 동작. 나머지 액션과 같은 무게로 두면 묻힌다 */}
          <button
            type="button"
            onClick={handleCopy}
            className="border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--card)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-transparent hover:text-[var(--ink)] active:scale-[0.98] transition-all min-w-[96px]"
          >
            {copied ? '✓ 복사됨' : '복사'}
          </button>

          <button type="button" onClick={() => fire('regenerate')} disabled={busy} className={actionClass}>
            {busy ? '만드는 중…' : '다시 생성'}
          </button>

          <button type="button" onClick={() => fire('shorter')} disabled={busy} className={actionClass}>
            더 짧게
          </button>

          <div className="relative" ref={toneRef}>
            <button
              type="button"
              onClick={() => setToneOpen((v) => !v)}
              disabled={busy}
              aria-haspopup="menu"
              aria-expanded={toneOpen}
              className={actionClass}
            >
              톤 바꾸기 ▾
            </button>

            {toneOpen && (
              <div
                role="menu"
                className="absolute left-0 bottom-full mb-2 z-20 min-w-[132px] border-2 border-[var(--ink)] py-1 shadow-[3px_3px_0_var(--ink)]"
                style={{ background: 'var(--card)' }}
              >
                {TONES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="menuitem"
                    onClick={() => fire(t.key)}
                    className="block w-full text-left px-3.5 py-2 text-[12px] font-semibold hover:bg-[var(--ink)] hover:text-[var(--card)] transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {previous && !busy && (
            <button
              type="button"
              onClick={() => onUndo(platform)}
              className={`${actionClass} text-[var(--soft)] ml-auto`}
            >
              ↩ 이전 버전으로
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
