import { PLATFORM_META, Platform } from '@/lib/types';

/** 아직 도착하지 않은 카드. 결과와 같은 모양이라 자리가 튀지 않는다 */
export function SummarySkeleton({ platform }: { platform: Platform }) {
  const meta = PLATFORM_META[platform];

  return (
    <div className="pb-5 border-b border-[var(--hair)]">
      <div className="flex items-baseline gap-2.5 mb-3">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] shrink-0" style={{ color: meta.color }}>
          {meta.no} · {meta.label}
        </span>
        <span className="flex-1 h-0.5 opacity-30 min-w-4" style={{ background: meta.color }} />
        <span className="np-label shrink-0">생성 중</span>
      </div>

      <div className="pl-3.5 border-l-[3px]" style={{ borderColor: meta.color }}>
        {['100%', '92%', '64%'].map((w) => (
          <div key={w} className="h-2.5 mb-2.5 np-pulse" style={{ width: w, background: 'var(--skeleton)' }} />
        ))}
        <p className="np-label mt-3">보통 10~20초 걸립니다</p>
      </div>
    </div>
  );
}
