'use client';

import { useState } from 'react';
import { PLATFORM_LIMITS, PLATFORM_LABELS, PlatformSummaries } from '@/lib/types';

interface SummaryCardProps {
  platform: keyof PlatformSummaries;
  text: string;
}

export function SummaryCard({ platform, text }: SummaryCardProps) {
  const [copied, setCopied] = useState(false);
  const limit = PLATFORM_LIMITS[platform];
  const label = PLATFORM_LABELS[platform];
  const count = text.length;
  const ratio = count / limit;

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">{label}</h3>
        <button
          onClick={handleCopy}
          className="text-xs px-3 py-1 rounded-full border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          {copied ? '✅ 복사됨!' : '📋 복사'}
        </button>
      </div>

      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>

      <div className="space-y-1">
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              ratio > 0.9 ? 'bg-red-400' : ratio > 0.7 ? 'bg-yellow-400' : 'bg-indigo-400'
            }`}
            style={{ width: `${Math.min(ratio * 100, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 text-right">
          {count} / {limit}자
        </p>
      </div>
    </div>
  );
}
