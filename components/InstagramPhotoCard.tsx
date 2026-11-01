'use client';

import { useMemo, useState } from 'react';
import { InstagramPhotoPost, InstagramPhotoSlide, InstagramSlide } from '@/lib/types';
import { CANVAS_BODY, waitForCardFonts } from '@/lib/fonts';
import { CARD_ACCENTS, DEFAULT_ACCENT, readStoredAccent, storeAccent } from '@/lib/card-theme';
import { useHydrated } from '@/lib/use-hydrated';
import { stripEmphasis } from '@/lib/handwriting';
import {
  PAPER, INK, INK_SOFT, INK_FAINT, S,
  drawHeadline, headlineHeight, drawBody, bodyHeight,
  drawChars, drawSlashes, drawSwoosh, drawInstaMark, drawPill, drawStat,
} from '@/lib/card-canvas';
import { HeadlinePreview, BodyPreview, Pill, Slash, InstaMark, CardFrame } from '@/components/CardParts';

/**
 * 사진 카드.
 *
 * 사진을 카드 전체에 깔고 글자를 얹으면 사진이 밝거나 복잡할 때 바로 못 읽는다.
 * 그래서 위 60% 는 종이(텍스트), 아래 40% 는 사진으로 나눈다. 글자가 사진 위에
 * 올라가지 않으므로 스크림이 필요 없고, 일반 카드와 같은 타이포를 그대로 쓴다.
 *
 * 수치·마무리 슬라이드는 사진 없이 일반 카드와 동일하게 그린다 — 수치는 숫자가
 * 주인공이라 60% 안에 다 들어가지 않고, 마무리는 안내 문구가 다섯 단이다.
 */
const PHOTO_RATIO = 0.4;
const TEXT_H = S * (1 - PHOTO_RATIO);

/** 텍스트 영역이 좁으므로 일반 카드보다 한 단계 작게 */
const PHOTO_HEAD = { cover: 112, content: 104 } as const;

interface InstagramPhotoCardProps {
  post: InstagramPhotoPost;
  onImageChange: (slideIndex: number, newUrl: string, bgColor?: string) => void;
  onRegenerateImage: (slideIndex: number, source: 'unsplash' | 'gpt') => void;
  isRegenerating: boolean;
  imageError: string | null;
}

/* ─── Canvas ─── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Unsplash 는 CORS 를 허용하고 GPT 이미지는 data URI 다.
    // 원문 기사 이미지는 쓰지 않으므로 여기서 막힐 일이 없다.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 아래 40% 에 사진을 꽉 채워 넣는다 (가운데 크롭) */
function drawPhotoBand(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const bandH = S * PHOTO_RATIO;
  const scale = Math.max(S / img.width, bandH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TEXT_H, S, bandH);
  ctx.clip();
  ctx.drawImage(img, (S - w) / 2, TEXT_H + (bandH - h) / 2, w, h);
  ctx.restore();
}

/** 사진이 없을 때 자리를 메우는 색 띠 */
function drawPhotoFallback(ctx: CanvasRenderingContext2D, accent: string) {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(0, TEXT_H, S, S * PHOTO_RATIO);
  ctx.restore();
}

function drawSplitCover(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
  const HL = PHOTO_HEAD.cover;
  const eyebrowH = slide.label ? 54 + 40 : 0;
  const hlH = headlineHeight(slide.headline, HL);
  const bodyH = slide.body ? 42 + bodyHeight(slide.body, 46) : 0;

  let y = Math.max(72, (TEXT_H - (eyebrowH + hlH + bodyH)) / 2);

  if (slide.label) {
    ctx.font = `54px "${CANVAS_BODY}"`;
    const w = ctx.measureText(slide.label).width;
    drawChars(ctx, [...slide.label].map((ch) => ({ ch, size: 54, color: INK_SOFT })),
      slide.label, 'soft', S / 2, y + 44, CANVAS_BODY);
    drawSlashes(ctx, S / 2 - w / 2 - 88, y + 26, 1, accent);
    drawSlashes(ctx, S / 2 + w / 2 + 88, y + 26, -1, accent);
    y += eyebrowH;
  }

  y += drawHeadline(ctx, slide.headline, y, HL, accent);
  if (slide.body) {
    y += 42;
    drawBody(ctx, slide.body, y, 46, INK_SOFT);
  }
}

function drawSplitContent(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
  const HL = PHOTO_HEAD.content;
  const kwH = slide.keyword ? 82 + 36 : 0;
  const hlH = headlineHeight(slide.headline, HL);
  const bodyH = slide.body ? 44 + bodyHeight(slide.body, 44) : 0;

  let y = Math.max(72, (TEXT_H - (kwH + hlH + bodyH)) / 2);

  if (slide.keyword) {
    drawPill(ctx, slide.keyword, S / 2, y, accent);
    y += kwH;
  }
  y += drawHeadline(ctx, slide.headline, y, HL, accent);
  if (slide.body) {
    y += 44;
    drawBody(ctx, slide.body, y, 44, INK_SOFT);
  }
}

const NEXT_LABEL = 'NEXT STORY';
const NEXT_CTA = '다음 편도 궁금하시다면\n팔로우해주세요';
const NEXT_BODY = 'AI시대 유용한\n기획/디자인 팁들을 전달해드릴게요';
const NEXT_HANDLE = '@mongle_ux';

/**
 * 사진 카드의 마무리 — 다음 편 예고.
 *
 * 강약: 예고 요약이 가장 크다. 독자가 팔로우할 이유가 거기서 나오기 때문이다.
 * 팔로우 요청은 밑줄로 묶어 행동을 분리하고, 무엇을 받는지는 그 아래 보조로 둔다.
 * 예고가 없는 글이면 요약 줄을 빼고 팔로우 요청이 헤드라인 자리를 차지한다.
 */
function drawNextStoryOutro(ctx: CanvasRenderingContext2D, nextStory: string, accent: string) {
  const hasStory = nextStory.trim().length > 0;
  const HL = hasStory ? 104 : 92;
  const headline = hasStory ? nextStory : NEXT_CTA;

  const labelH = 54 + 40;
  const hlH = headlineHeight(headline, HL);
  const ctaH = hasStory ? 46 + bodyHeight(NEXT_CTA, 48) : 0;
  const bodyH = 40 + bodyHeight(NEXT_BODY, 42);
  const markH = 104;
  const handleH = 20 + bodyHeight(NEXT_HANDLE, 38);

  let y = Math.max(96, (S - (labelH + hlH + ctaH + bodyH + markH + handleH)) / 2);

  // 머리말
  ctx.font = `54px "${CANVAS_BODY}"`;
  const lw = ctx.measureText(NEXT_LABEL).width;
  drawChars(ctx, [...NEXT_LABEL].map((ch) => ({ ch, size: 54, color: accent })),
    NEXT_LABEL, 'soft', S / 2, y + 44, CANVAS_BODY);
  drawSlashes(ctx, S / 2 - lw / 2 - 88, y + 26, 1, accent);
  drawSlashes(ctx, S / 2 + lw / 2 + 88, y + 26, -1, accent);
  y += labelH;

  y += drawHeadline(ctx, headline, y, HL, accent);

  if (hasStory) {
    y += 46;
    const h = drawBody(ctx, NEXT_CTA, y, 48, INK);
    ctx.font = `48px "${CANVAS_BODY}"`;
    const widest = Math.max(...NEXT_CTA.split('\n').map((l) => ctx.measureText(l).width));
    drawSwoosh(ctx, S / 2, y + h + 26, Math.min(widest + 30, S - 150), accent);
    y += h;
  }

  y += 40;
  y += drawBody(ctx, NEXT_BODY, y, 42, INK_SOFT);

  y += 52;
  drawInstaMark(ctx, S / 2, y + 30, 30, accent);
  y += markH;

  y += 20;
  drawBody(ctx, NEXT_HANDLE, y, 38, INK_FAINT);
}

async function buildPhotoCanvas(
  slide: InstagramPhotoSlide,
  index: number,
  total: number,
  accent: string,
  nextStory: string,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);

  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');
  const withPhoto = layout === 'cover' || layout === 'content';

  if (withPhoto) {
    if (slide.image_url) {
      try {
        drawPhotoBand(ctx, await loadImage(slide.image_url));
      } catch {
        drawPhotoFallback(ctx, accent); // 사진을 못 받아도 카드는 나온다
      }
    } else {
      drawPhotoFallback(ctx, accent);
    }
    if (layout === 'cover') drawSplitCover(ctx, slide, accent);
    else drawSplitContent(ctx, slide, accent);
  } else if (layout === 'stat') {
    drawStat(ctx, slide, accent);
  } else {
    drawNextStoryOutro(ctx, nextStory, accent);
  }

  // 분할 카드는 텍스트 영역이 좁아 머리말과 번호가 같은 높이에서 부딪힌다.
  // 사진 위 우하단으로 내리고, 사진이 밝아도 읽히도록 그림자를 깐다.
  if (withPhoto) {
    ctx.save();
    ctx.font = `34px "${CANVAS_BODY}"`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 10;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${index + 1} / ${total}`, S - 54, S - 44);
    ctx.restore();
  } else if (layout !== 'stat') {
    ctx.font = `34px "${CANVAS_BODY}"`;
    ctx.fillStyle = INK_FAINT;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${index + 1} / ${total}`, S - 76, 76);
  }
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

function SplitFrame({
  slide, index, total, accent, children,
}: {
  slide: InstagramPhotoSlide; index: number; total: number; accent: string; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        containerType: 'inline-size', width: '100%', aspectRatio: '1', background: PAPER,
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}
    >
      <span style={{
        position: 'absolute', bottom: '4.1cqw', right: '5cqw', fontSize: '3.1cqw', zIndex: 2,
        color: 'rgba(255,255,255,0.92)', textShadow: '0 1px 6px rgba(0,0,0,0.45)',
        fontFamily: `"${CANVAS_BODY}", sans-serif`,
      }}>{index + 1} / {total}</span>

      <div style={{
        height: `${(1 - PHOTO_RATIO) * 100}%`, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 7.5cqw',
      }}>
        {children}
      </div>

      <div style={{ height: `${PHOTO_RATIO * 100}%`, background: `${accent}1f`, overflow: 'hidden' }}>
        {slide.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
      </div>
    </div>
  );
}

function NextStoryPreview({ nextStory, accent }: { nextStory: string; accent: string }) {
  const hasStory = nextStory.trim().length > 0;
  return (
    <CardFrame index={0} total={0} showNumber={false}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '2.8cqw', marginBottom: '3.4cqw',
      }}>
        <Slash accent={accent} />
        <span style={{ fontFamily: `"${CANVAS_BODY}", sans-serif`, fontSize: '5cqw', color: accent }}>
          {NEXT_LABEL}
        </span>
        <Slash flip accent={accent} />
      </div>

      <HeadlinePreview raw={hasStory ? nextStory : NEXT_CTA} basePx={hasStory ? 104 : 92} accent={accent} />

      {hasStory && (
        <div style={{ marginTop: '4.3cqw', position: 'relative', display: 'inline-block' }}>
          <BodyPreview raw={NEXT_CTA} basePx={48} color={INK} />
          <svg width="100%" height="1.3cqw" viewBox="0 0 150 10" preserveAspectRatio="none"
            style={{ position: 'absolute', left: 0, bottom: '-2.4cqw' }}>
            <path d="M3 6 C40 1, 110 1, 147 5" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      )}

      <div style={{ marginTop: '3.7cqw' }}>
        <BodyPreview raw={NEXT_BODY} basePx={42} color={INK_SOFT} />
      </div>

      <div style={{ marginTop: '4.8cqw', display: 'flex', justifyContent: 'center' }}>
        <InstaMark accent={accent} />
      </div>
      <div style={{ marginTop: '1.9cqw' }}>
        <BodyPreview raw={NEXT_HANDLE} basePx={38} color={INK_FAINT} />
      </div>
    </CardFrame>
  );
}

function PhotoSlidePreview({
  slide, index, total, accent, nextStory,
}: { slide: InstagramPhotoSlide; index: number; total: number; accent: string; nextStory: string }) {
  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');

  if (layout === 'outro') return <NextStoryPreview nextStory={nextStory} accent={accent} />;

  if (layout === 'stat') {
    return (
      <CardFrame index={index} total={total} showNumber={false}>
        <Pill text={slide.stat_badge || '수치'} accent={accent} />
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2cqw',
          fontFamily: 'var(--font-ig-head)', lineHeight: 0.9,
        }}>
          <span style={{ fontSize: '28cqw', color: accent, display: 'inline-block' }}>
            {slide.stat_value || '—'}
          </span>
          {slide.stat_unit && <span style={{ fontSize: '12cqw' }}>{slide.stat_unit}</span>}
        </div>
        {slide.headline && (
          <div style={{ marginTop: '4.6cqw' }}>
            <BodyPreview raw={stripEmphasis(slide.headline)} basePx={50} color={INK_SOFT} />
          </div>
        )}
        {slide.source && (
          <div style={{ marginTop: '2.4cqw' }}>
            <BodyPreview raw={slide.source} basePx={37} color={INK_FAINT} />
          </div>
        )}
      </CardFrame>
    );
  }

  if (layout === 'cover') {
    return (
      <SplitFrame slide={slide} index={index} total={total} accent={accent}>
        {slide.label && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '2.8cqw', marginBottom: '3.4cqw',
          }}>
            <Slash accent={accent} />
            <span style={{ fontFamily: `"${CANVAS_BODY}", sans-serif`, fontSize: '5cqw', color: INK_SOFT }}>
              {slide.label}
            </span>
            <Slash flip accent={accent} />
          </div>
        )}
        <HeadlinePreview raw={slide.headline} basePx={PHOTO_HEAD.cover} accent={accent} />
        {slide.body && (
          <div style={{ marginTop: '3.9cqw' }}>
            <BodyPreview raw={slide.body} basePx={46} color={INK_SOFT} />
          </div>
        )}
      </SplitFrame>
    );
  }

  return (
    <SplitFrame slide={slide} index={index} total={total} accent={accent}>
      {slide.keyword && <Pill text={slide.keyword} accent={accent} />}
      <HeadlinePreview raw={slide.headline} basePx={PHOTO_HEAD.content} accent={accent} />
      {slide.body && (
        <div style={{ marginTop: '4.1cqw' }}>
          <BodyPreview raw={slide.body} basePx={44} color={INK_SOFT} />
        </div>
      )}
    </SplitFrame>
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

  // 다음 편 예고는 원문 레터 말미에서 AI 가 뽑아 2줄로 줄인 것이다.
  // 없는 글이면 빈 문자열이고, 그때는 팔로우 요청이 헤드라인 자리로 올라간다.
  const nextStory = (post.next_story || '').trim();

  const outroSlide: InstagramPhotoSlide = {
    slide_number: post.slides.length + 1,
    layout: 'outro',
    headline: nextStory,
    background_color: PAPER,
    accent_color: accent,
    image_url: '',
  };

  const slides = [...post.slides, outroSlide];
  const total = slides.length;
  const slide = slides[current];
  const layout = slide.layout ?? (current === 0 ? 'cover' : 'content');
  const canSwapPhoto = layout === 'cover' || layout === 'content';

  async function save(target: InstagramPhotoSlide, i: number) {
    await waitForCardFonts();
    triggerDownload(await buildPhotoCanvas(target, i, total, accent, nextStory), `photo-slide-${i + 1}.png`);
  }

  async function handleDownloadCurrent() {
    setSaving(true);
    try { await save(slide, current); } finally { setSaving(false); }
  }

  async function handleDownloadAll() {
    setSaving(true);
    try {
      await waitForCardFonts();
      for (let i = 0; i < slides.length; i++) {
        triggerDownload(await buildPhotoCanvas(slides[i], i, total, accent, nextStory), `photo-slide-${i + 1}.png`);
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
          <PhotoSlidePreview slide={slide} index={current} total={total} accent={accent} nextStory={nextStory} />
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
