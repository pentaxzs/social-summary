'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { InstagramPhotoPost, InstagramPhotoSlide } from '@/lib/types';
import { waitForPhotoFonts } from '@/lib/fonts';
import { CARD_ACCENTS, DEFAULT_ACCENT, readStoredAccent, storeAccent } from '@/lib/card-theme';
import { useHydrated } from '@/lib/use-hydrated';
import { stripEmphasis } from '@/lib/handwriting';
import {
  S, PAPER, PROFILE, recapItems, photoHeightFor,
  drawPhotoTop, drawPageBadge, drawPhotoText, drawFollowSlide,
} from '@/lib/photo-canvas';

interface InstagramPhotoCardProps {
  post: InstagramPhotoPost;
  onImageChange: (slideIndex: number, newUrl: string, bgColor?: string) => void;
  onRegenerateImage: (slideIndex: number, source: 'unsplash' | 'gpt') => void;
  isRegenerating: boolean;
  imageError: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Unsplash 는 CORS 를 허용하고 생성 이미지는 data URI 다.
    // 같은 출처인 /profile.png 도 문제없다.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function tryLoad(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  try {
    return await loadImage(src);
  } catch {
    return null; // 못 받아도 카드는 나온다
  }
}

/** null 슬라이드가 마지막 팔로우 장이다 */
async function buildPhotoCanvas(
  slide: InstagramPhotoSlide | null,
  index: number,
  total: number,
  accent: string,
  nextStory: string,
  recap: string[],
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);

  if (!slide) {
    const avatar = await tryLoad(PROFILE.avatar);
    drawFollowSlide(ctx, { recap, nextStory, avatar, accent });
    drawPageBadge(ctx, index, total, false);
    return canvas;
  }

  const img = await tryLoad(slide.image_url);
  const eyebrow = slide.keyword || slide.label;
  const photoH = photoHeightFor(ctx, slide.headline, slide.body, !!eyebrow);
  drawPhotoTop(ctx, img, accent, photoH);
  drawPhotoText(ctx, slide.headline, slide.body, accent, { eyebrow, topOffset: photoH + 56 });
  drawPageBadge(ctx, index, total, !!img);
  return canvas;
}

function triggerDownload(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/* ─── 미리보기 ─── */

/**
 * 미리보기는 저장되는 PNG 를 그대로 축소해 보여준다.
 * 같은 화면을 React 와 Canvas 로 두 번 그리던 동안 둘이 계속 어긋났다 —
 * 글이 길면 PNG 는 줄여서 담고 미리보기는 잘라냈다. 이제 그릴 수 없다.
 */
function PhotoSlidePreview({
  slide, index, total, accent, nextStory, recap,
}: {
  slide: InstagramPhotoSlide | null; index: number; total: number;
  accent: string; nextStory: string; recap: string[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stale = false;
    (async () => {
      await waitForPhotoFonts();
      const drawn = await buildPhotoCanvas(slide, index, total, accent, nextStory, recap);
      if (stale || !ref.current) return;
      const ctx = ref.current.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, S, S);
      ctx.drawImage(drawn, 0, 0);
    })();
    return () => { stale = true; };
  }, [slide, index, total, accent, nextStory, recap]);

  return (
    <canvas ref={ref} width={S} height={S}
      style={{ width: '100%', aspectRatio: '1', display: 'block', background: PAPER }} />
  );
}

/* ─── 본체 ─── */

export function InstagramPhotoCard({
  post, onRegenerateImage, isRegenerating, imageError,
}: InstagramPhotoCardProps) {
  const [current, setCurrent] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [saving, setSaving] = useState(false);

  const hydrated = useHydrated();
  const stored = useMemo(() => (hydrated ? readStoredAccent() : DEFAULT_ACCENT), [hydrated]);
  const [picked, setPicked] = useState<string | null>(null);
  const accent = picked ?? stored;

  const nextStory = stripEmphasis(post.next_story || '').trim()
    ? (post.next_story || '').trim()
    : '';

  const recap = useMemo(
    () => recapItems(post.slides.map((s) => s.headline)),
    [post.slides],
  );

  const slides: (InstagramPhotoSlide | null)[] = [...post.slides, null];
  const total = slides.length;
  const slide = slides[current];
  const canSwapPhoto = slide !== null;

  async function save(target: InstagramPhotoSlide | null, i: number) {
    await waitForPhotoFonts();
    triggerDownload(
      await buildPhotoCanvas(target, i, total, accent, nextStory, recap),
      `photo-slide-${i + 1}.png`,
    );
  }

  async function handleDownloadCurrent() {
    setSaving(true);
    try { await save(slide, current); } finally { setSaving(false); }
  }

  async function handleDownloadAll() {
    setSaving(true);
    try {
      await waitForPhotoFonts();
      for (let i = 0; i < slides.length; i++) {
        triggerDownload(
          await buildPhotoCanvas(slides[i], i, total, accent, nextStory, recap),
          `photo-slide-${i + 1}.png`,
        );
        await new Promise((r) => setTimeout(r, 350));
      }
    } finally { setSaving(false); }
  }

  async function handleCopyCaption() {
    try {
      await navigator.clipboard.writeText(post.caption);
      setCopiedCaption(true);
      setTimeout(() => setCopiedCaption(false), 2000);
    } catch { /* 권한 없으면 조용히 넘어간다 */ }
  }

  const act =
    'text-[11px] font-bold uppercase tracking-[0.12em] underline underline-offset-4 ' +
    'hover:no-underline disabled:opacity-35 disabled:cursor-not-allowed transition';

  return (
    <article className="pb-5 border-b border-[var(--hair)]">
      <div className="flex items-baseline gap-2.5 mb-3">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.2em] shrink-0" style={{ color: '#6e1b33' }}>
          06 · 사진 카드
        </h3>
        <span className="flex-1 h-0.5 opacity-30 min-w-4" style={{ background: '#6e1b33' }} />
        <span className="text-[11px] tracking-wider tabular-nums text-[var(--soft)] shrink-0">{total}장</span>
      </div>

      <div className="pl-3.5 border-l-[3px] min-w-0" style={{ borderColor: '#6e1b33' }}>
        <div className="max-w-[420px]">
          <PhotoSlidePreview slide={slide} index={current} total={total}
            accent={accent} nextStory={nextStory} recap={recap} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mt-3">
          <button type="button" onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0} className={act}>← 이전</button>
          <span className="text-[11px] tabular-nums text-[var(--soft)]">{current + 1} / {total}</span>
          <button type="button" onClick={() => setCurrent(Math.min(total - 1, current + 1))}
            disabled={current === total - 1} className={act}>다음 →</button>

          <div className="flex items-center gap-2 ml-auto" role="group" aria-label="키 컬러">
            <span className="np-label">키 컬러</span>
            {CARD_ACCENTS.map((a) => {
              const on = accent === a.value;
              return (
                <button key={a.key} type="button" title={a.label} aria-label={a.label} aria-pressed={on}
                  onClick={() => { setPicked(a.value); storeAccent(a.value); }}
                  className={`w-5 h-5 rounded-full transition-transform ${on ? 'scale-110' : 'hover:scale-105'}`}
                  style={{ background: a.value, boxShadow: on ? `0 0 0 2px var(--paper), 0 0 0 4px ${a.value}` : 'none' }} />
              );
            })}
          </div>
        </div>

        {canSwapPhoto && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            <span className="np-label">사진 교체</span>
            <button type="button" onClick={() => onRegenerateImage(current, 'unsplash')}
              disabled={isRegenerating} className={act}>Unsplash</button>
            <button type="button" onClick={() => onRegenerateImage(current, 'gpt')}
              disabled={isRegenerating} className={act}>AI 생성</button>
            {isRegenerating && <span className="text-[11px] text-[var(--soft)]">가져오는 중…</span>}
            {!slide?.image_url && !isRegenerating && (
              <span className="text-[11px] text-[var(--soft)]">
                사진 없음 — Unsplash 키를 넣으면 자동으로 붙습니다
              </span>
            )}
          </div>
        )}
        {imageError && <p className="mt-2 text-xs text-[#8a2a12] break-words">⚠ {imageError}</p>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3.5 pt-2.5 border-t border-[var(--hair)]">
          <button type="button" onClick={handleDownloadCurrent} disabled={saving}
            className="border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--card)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-transparent hover:text-[var(--ink)] active:scale-[0.98] disabled:opacity-40 transition-all min-w-[96px]">
            {saving ? '저장 중…' : 'PNG 저장'}
          </button>
          <button type="button" onClick={handleDownloadAll} disabled={saving} className={act}>전체 저장</button>
          <button type="button" onClick={handleCopyCaption} className={act}>
            {copiedCaption ? '✓ 캡션 복사됨' : '캡션 복사'}
          </button>
        </div>

        <p className="mt-3.5 text-sm leading-[1.8] whitespace-pre-wrap break-words text-[var(--soft)]">
          {post.caption}
        </p>
        <p className="np-label mt-1.5 text-right">{post.caption.length}자</p>
      </div>
    </article>
  );
}
