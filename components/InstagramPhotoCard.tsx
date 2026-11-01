'use client';

import { useMemo, useState } from 'react';
import { InstagramPhotoPost, InstagramPhotoSlide } from '@/lib/types';
import { waitForPhotoFonts, PHOTO_HEAD_FONT, PHOTO_BODY_FONT } from '@/lib/fonts';
import { CARD_ACCENTS, DEFAULT_ACCENT, readStoredAccent, storeAccent } from '@/lib/card-theme';
import { useHydrated } from '@/lib/use-hydrated';
import { stripEmphasis } from '@/lib/handwriting';
import {
  S, PAD, PHOTO_H, PAPER, INK, INK_SOFT, INK_FAINT, PROFILE,
  FOLLOW_HEAD, FOLLOW_BODY, RECAP_LABEL, HAIRLINE,
  RECAP_ROW_MAX, RECAP_ROW_MIN, RECAP_GAP_TOP, pxToCqw, recapItems,
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
  drawPhotoTop(ctx, img, accent);
  drawPhotoText(ctx, slide.headline, slide.body, accent, { eyebrow: slide.keyword || slide.label });
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
 * next/font 가 만드는 CSS 변수(--font-photo-head)는 쓰지 않는다.
 * declarations 로 @font-face 의 이름을 PretendardBoldCanvas 로 고정해 둔 탓에
 * 그 변수는 존재하지 않는 패밀리를 가리키고, 미리보기만 대체 폰트로 그려졌다.
 * Canvas 와 같은 이름을 직접 쓰면 두 쪽이 어긋날 수 없다.
 */
const headFont = `"${PHOTO_HEAD_FONT}", -apple-system, sans-serif`;
const bodyFont = `"${PHOTO_BODY_FONT}", -apple-system, sans-serif`;

function Badge({ index, total, onPhoto }: { index: number; total: number; onPhoto: boolean }) {
  return (
    <span style={{
      position: 'absolute', top: '6cqw', right: '6.7cqw', zIndex: 3,
      width: '8.5cqw', height: '8.5cqw', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: onPhoto ? 'rgba(20,23,26,0.55)' : 'rgba(20,23,26,0.08)',
      color: onPhoto ? '#fff' : INK_SOFT,
      fontFamily: headFont, fontSize: '3.1cqw',
    }}>{index + 1}/{total}</span>
  );
}

/** 강조 구간(*…*)만 키 컬러로 */
function Emphasised({ raw, accent }: { raw: string; accent: string }) {
  const parts = raw.replace(/\\n/g, '\n').split(/(\*[^*\n]+\*)/);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2
          ? <span key={i} style={{ color: accent }}>{p.slice(1, -1)}</span>
          : <span key={i}>{p}</span>,
      )}
    </>
  );
}

function FollowCardRow() {
  return (
    <div style={{
      marginTop: pxToCqw(48), display: 'flex', alignItems: 'center', gap: '3.5cqw',
      background: '#fff', borderRadius: '2.6cqw', padding: '3.5cqw',
      boxShadow: '0 3px 24px rgba(20,23,26,0.14)',
    }}>
      <span style={{
        width: '10.4cqw', height: '10.4cqw', borderRadius: '50%', flex: 'none',
        background: '#f1f3f5', boxShadow: `inset 0 0 0 2px ${HAIRLINE}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: headFont, fontSize: '4.8cqw', color: INK_FAINT, overflow: 'hidden',
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PROFILE.avatar} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontFamily: headFont, fontSize: '3.7cqw', color: INK }}>
          {PROFILE.handle}
        </span>
        <span style={{ display: 'block', fontFamily: bodyFont, fontSize: '2.8cqw', color: INK_FAINT }}>
          {PROFILE.name}
        </span>
      </span>
      <span style={{
        background: '#0095f6', color: '#fff', borderRadius: '1.7cqw',
        padding: '1.9cqw 4.4cqw', fontFamily: headFont, fontSize: '3.5cqw', flex: 'none',
        position: 'relative',
      }}>
        팔로우
        {/* PNG 쪽 drawCursor 와 같은 모양·같은 자리 */}
        <svg viewBox="0 0 22 34" aria-hidden
          style={{ position: 'absolute', left: '74.5%', top: '69.8%', width: '3.05cqw', overflow: 'visible' }}>
          <path d="M0 0 L0 30 L7.5 23 L12.5 34 L17.5 31.5 L12.5 21 L22 20 Z"
            fill="#15171a" stroke="#ffffff" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

/** 마지막 장 — 목차 / 다음 편 예고 / 팔로우 */
function FollowSlidePreview({
  recap, nextStory, accent,
}: { recap: string[]; nextStory: string; accent: string }) {
  const hasStory = nextStory.trim().length > 0;
  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      padding: `${pxToCqw(PAD)} 6.7cqw 6.7cqw`, overflow: 'hidden', textAlign: 'left',
    }}>
      <div style={{ fontFamily: bodyFont, fontSize: '2.8cqw', color: INK_FAINT, paddingTop: pxToCqw(40) }}>
        {RECAP_LABEL}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginTop: pxToCqw(RECAP_GAP_TOP - 20) }}>
        {recap.map((text, i) => (
          <div key={i} style={{
            flex: 1, minHeight: pxToCqw(RECAP_ROW_MIN), maxHeight: pxToCqw(RECAP_ROW_MAX),
            display: 'flex', alignItems: 'center', gap: pxToCqw(20),
            borderBottom: i < recap.length - 1 ? `2px solid ${HAIRLINE}` : 'none',
          }}>
            <span style={{
              width: pxToCqw(38), height: pxToCqw(38), borderRadius: '50%', flex: 'none',
              background: accent, color: '#fff', fontFamily: headFont, fontSize: '2.2cqw',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{i + 1}</span>
            <span style={{
              fontFamily: headFont, fontSize: '3.5cqw', color: INK, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{text}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: pxToCqw(24) }}>
        {hasStory && (
          <div style={{ fontFamily: headFont, fontSize: '3cqw', color: accent, marginBottom: pxToCqw(16) }}>
            NEXT STORY
          </div>
        )}
        <div style={{
          fontFamily: headFont, fontSize: '5.2cqw', lineHeight: 1.32, color: INK,
          whiteSpace: 'pre-line', wordBreak: 'keep-all',
        }}>
          <Emphasised raw={hasStory ? nextStory : FOLLOW_HEAD} accent={accent} />
        </div>
        <div style={{
          fontFamily: bodyFont, fontSize: '2.8cqw', lineHeight: 1.5, color: INK_SOFT,
          marginTop: pxToCqw(16), wordBreak: 'keep-all',
        }}>{FOLLOW_BODY}</div>
      </div>

      <FollowCardRow />
    </div>
  );
}

function PhotoSlidePreview({
  slide, index, total, accent, nextStory, recap,
}: {
  slide: InstagramPhotoSlide | null; index: number; total: number;
  accent: string; nextStory: string; recap: string[];
}) {
  const isFollow = slide === null;

  return (
    <div style={{
      containerType: 'inline-size', width: '100%', aspectRatio: '1', background: PAPER,
      position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <Badge index={index} total={total} onPhoto={!isFollow && !!slide?.image_url} />

      {isFollow ? (
        <FollowSlidePreview recap={recap} nextStory={nextStory} accent={accent} />
      ) : (
        <>
          <div style={{
            height: `${(PHOTO_H / S) * 100}%`, background: `${accent}24`,
            overflow: 'hidden', flex: 'none',
          }}>
            {slide.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.image_url} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </div>

          <div style={{
            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
            padding: '5.2cqw 6.7cqw 6.7cqw', textAlign: 'left', overflow: 'hidden',
          }}>
            {(slide.keyword || slide.label) && (
              <div style={{ fontFamily: headFont, fontSize: '3.2cqw', color: accent, marginBottom: '2cqw' }}>
                {slide.keyword || slide.label}
              </div>
            )}
            <div style={{
              fontFamily: headFont, fontSize: '6.7cqw', lineHeight: 1.3, color: INK,
              whiteSpace: 'pre-line', wordBreak: 'keep-all',
            }}>
              <Emphasised raw={slide.headline} accent={accent} />
            </div>
            {slide.body && (
              <div style={{
                fontFamily: bodyFont, fontSize: '3.7cqw', lineHeight: 1.58, color: INK_SOFT,
                marginTop: '3.2cqw', whiteSpace: 'pre-line', wordBreak: 'keep-all',
              }}>{slide.body}</div>
            )}
          </div>
        </>
      )}
    </div>
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
