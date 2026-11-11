'use client';

import { CARD_COUNTS } from '@/lib/types';

/**
 * 카드 묶음을 몇 장으로 다시 만들지 고른다.
 * 숫자가 여섯 개뿐이라 드롭다운보다 한 번에 보이는 편이 낫다.
 */
export function CardCountPicker({
  value, onChange, onRegenerate, busy, color,
}: {
  value: number;
  onChange: (n: number) => void;
  onRegenerate: () => void;
  busy: boolean;
  color: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="np-label">장수</span>
      <div className="flex border border-[var(--hair)]" role="group" aria-label="카드 장수">
        {CARD_COUNTS.map((n) => {
          const on = n === value;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              disabled={busy}
              onClick={() => onChange(n)}
              className={`w-8 h-7 text-[12px] tabular-nums border-r border-[var(--hair)] last:border-r-0
                disabled:opacity-40 transition-colors ${on ? 'text-[var(--card)]' : 'hover:bg-[var(--hair)]/50'}`}
              style={on ? { background: color } : undefined}
            >
              {n}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={busy}
        className="text-[11px] font-bold uppercase tracking-[0.12em] underline underline-offset-4 hover:no-underline disabled:opacity-35 disabled:cursor-not-allowed transition"
      >
        {busy ? '만드는 중…' : '다시 생성'}
      </button>
    </div>
  );
}
