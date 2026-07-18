'use client';

import { useState } from 'react';
import { PLATFORM_LIMITS, PLATFORM_LABELS, PlatformSummaries } from '@/lib/types';

interface SummaryCardProps {
  platform: keyof PlatformSummaries;
  text: string;
}

const PLATFORM_COLORS: Record<keyof PlatformSummaries, string> = {
  twitter: 'border-neutral-900',
  thread: 'border-neutral-900',
  linkedin: 'border-neutral-900',
  geekNews: 'border-neutral-900',
};

const PLATFORM_BADGE: Record<keyof PlatformSummaries, string> = {
  twitter: 'bg-neutral-900 text-amber-50',
  thread: 'bg-neutral-900 text-amber-50',
  linkedin: 'bg-neutral-900 text-amber-50',
  geekNews: 'bg-neutral-900 text-amber-50',
};

export function SummaryCard({ platform, text }: SummaryCardProps) {
  const [copied, setCopied] = useState(false);
  const limit = PLATFORM_LIMITS[platform];
  const label = PLATFORM_LABELS[platform];
  const count = text.length;
  const ratio = Math.min(count / limit, 1);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`border-2 ${PLATFORM_COLORS[platform]} overflow-hidden`} style={{ background: '#faf6ee' }}>
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b-2 border-neutral-900">
        <span className={`text-xs sm:text-sm font-bold px-3 py-1 uppercase tracking-wider ${PLATFORM_BADGE[platform]}`}>
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 border border-neutral-400 text-neutral-600 hover:bg-neutral-900 hover:text-amber-50 active:scale-95 transition-all"
          style={{ background: '#f5f0e8' }}
        >
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>

      {/* 요약 텍스트 */}
      <p className="px-4 sm:px-5 py-4 text-sm sm:text-base text-neutral-800 whitespace-pre-wrap break-words leading-relaxed">
        {text}
      </p>

      {/* 글자 수 바 */}
      <div className="px-4 sm:px-5 pb-4 space-y-1.5">
        <div className="h-1 bg-neutral-200 overflow-hidden">
          <div
            className="h-full bg-neutral-900 transition-all duration-500"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="text-xs text-neutral-400 text-right tabular-nums">
          {count.toLocaleString()} / {limit.toLocaleString()}자
        </p>
      </div>
    </div>
  );
}
