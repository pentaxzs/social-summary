'use client';

import { useState } from 'react';
import { PLATFORM_LIMITS, PLATFORM_LABELS, PlatformSummaries } from '@/lib/types';

interface SummaryCardProps {
  platform: keyof PlatformSummaries;
  text: string;
}

const PLATFORM_COLORS: Record<keyof PlatformSummaries, string> = {
  twitter: 'from-sky-50 to-white border-sky-200',
  thread: 'from-gray-50 to-white border-gray-200',
  linkedin: 'from-blue-50 to-white border-blue-200',
  geekNews: 'from-pink-50 to-white border-pink-200',
};

const PLATFORM_BADGE: Record<keyof PlatformSummaries, string> = {
  twitter: 'bg-sky-100 text-sky-700',
  thread: 'bg-gray-100 text-gray-700',
  linkedin: 'bg-blue-100 text-blue-700',
  geekNews: 'bg-pink-100 text-pink-700',
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
    <div className={`rounded-2xl border bg-gradient-to-br ${PLATFORM_COLORS[platform]} shadow-sm overflow-hidden`}>
      {/* 카드 헤더 */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-inherit">
        <span className={`text-sm sm:text-base font-bold px-3 py-1 rounded-full ${PLATFORM_BADGE[platform]}`}>
          {label}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 active:scale-95 transition-all shadow-sm"
        >
          {copied ? '✅ 복사됨!' : '📋 복사'}
        </button>
      </div>

      {/* 요약 텍스트 */}
      <p className="px-4 sm:px-5 py-4 text-sm sm:text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
        {text}
      </p>

      {/* 글자 수 바 */}
      <div className="px-4 sm:px-5 pb-4 space-y-1.5">
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              ratio > 0.9 ? 'bg-red-400' : ratio > 0.7 ? 'bg-yellow-400' : 'bg-indigo-400'
            }`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right tabular-nums">
          {count.toLocaleString()} / {limit.toLocaleString()}자
        </p>
      </div>
    </div>
  );
}
