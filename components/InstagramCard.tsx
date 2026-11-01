'use client';

import { useMemo, useState } from 'react';
import { InstagramPost, InstagramSlide } from '@/lib/types';
import { CANVAS_HEAD, CANVAS_BODY, waitForCardFonts } from '@/lib/fonts';
import { CARD_ACCENTS, DEFAULT_ACCENT, readStoredAccent, storeAccent } from '@/lib/card-theme';
import { useHydrated } from '@/lib/use-hydrated';
import { stripEmphasis } from '@/lib/handwriting';
import {
  PAPER, INK, INK_SOFT, INK_FAINT, S, HEAD_SIZE,
  OUTRO_BODY, OUTRO_CTA, OUTRO_HANDLE,
  drawCover, drawContent, drawStat, drawOutro,
} from '@/lib/card-canvas';
import {
  HeadlinePreview, BodyPreview, Jittered, Slash, InstaMark, Pill, CardFrame,
} from '@/components/CardParts';

/* ─── Canvas 조립 ─── */

function buildCanvas(slide: InstagramSlide, index: number, total: number, accent: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);

  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');
  if (layout === 'cover') drawCover(ctx, slide, accent);
  else if (layout === 'stat') drawStat(ctx, slide, accent);
  else if (layout === 'outro') drawOutro(ctx, slide, accent);
  else drawContent(ctx, slide, accent);

  if (layout !== 'stat') {
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

/* ─── 미리보기: Canvas 와 같은 규칙으로 ─── */

function SlidePreview({ slide, index, total, accent }: {
  slide: InstagramSlide; index: number; total: number; accent: string;
}) {
  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');

  if (layout === 'stat') {
    return (
      <CardFrame index={index} total={total} showNumber={false}>
        <Pill text={slide.stat_badge || '수치'} accent={accent} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2cqw',
          fontFamily: `"${CANVAS_HEAD}", sans-serif`, lineHeight: 0.9 }}>
          <span style={{ fontSize: '28cqw', color: accent, display: 'inline-block' }}>
            <Jittered runs={[{ text: slide.stat_value || '—', emphasis: false }]} strength="strong" />
          </span>
          {slide.stat_unit && <span style={{ fontSize: '12cqw', color: INK }}>{slide.stat_unit}</span>}
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
      <CardFrame index={index} total={total}>
        {slide.label && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '2.8cqw', marginBottom: '3.8cqw' }}>
            <Slash accent={accent} />
            <span style={{ fontFamily: `"${CANVAS_BODY}", sans-serif`, fontSize: '5cqw', color: INK }}>
              <Jittered runs={[{ text: slide.label, emphasis: false }]} strength="soft" />
            </span>
            <Slash flip accent={accent} />
          </div>
        )}
        <HeadlinePreview raw={slide.headline} basePx={HEAD_SIZE.cover} accent={accent} />
        {slide.body && (
          <div style={{ marginTop: '4.3cqw' }}>
            <BodyPreview raw={slide.body} basePx={48} color={INK_SOFT} />
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '6cqw', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <InstaMark accent={accent} />
        </div>
      </CardFrame>
    );
  }

  if (layout === 'outro') {
    return (
      <CardFrame index={index} total={total}>
        <HeadlinePreview raw={slide.headline} basePx={HEAD_SIZE.outro} accent={accent} />
        {slide.body && (
          <div style={{ marginTop: '4.6cqw' }}>
            <BodyPreview raw={slide.body} basePx={OUTRO_BODY} color={INK_SOFT} />
          </div>
        )}
        {slide.cta && (
          <div style={{ marginTop: '4.1cqw', position: 'relative', display: 'inline-block' }}>
            <BodyPreview raw={slide.cta} basePx={OUTRO_CTA} color={INK} />
            <svg width="100%" height="1.3cqw" viewBox="0 0 150 10" preserveAspectRatio="none"
              style={{ position: 'absolute', left: 0, bottom: '-2.4cqw' }}>
              <path d="M3 6 C40 1, 110 1, 147 5" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <div style={{ marginTop: '6.4cqw', display: 'flex', justifyContent: 'center' }}>
          <InstaMark accent={accent} />
        </div>
        {slide.handle && (
          <div style={{ marginTop: '2cqw' }}>
            <BodyPreview raw={slide.handle} basePx={OUTRO_HANDLE} color={INK_FAINT} />
          </div>
        )}
      </CardFrame>
    );
  }

  return (
    <CardFrame index={index} total={total}>
      {slide.keyword && <Pill text={slide.keyword} accent={accent} />}
      <HeadlinePreview raw={slide.headline} basePx={HEAD_SIZE.content} accent={accent} />
      {slide.body && (
        <div style={{ marginTop: '4.6cqw' }}>
          <BodyPreview raw={slide.body} basePx={46} color={INK_SOFT} />
        </div>
      )}
    </CardFrame>
  );
}

/* ─── 본체 ─── */

export function InstagramCard({ post }: { post: InstagramPost }) {
  const [current, setCurrent] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [saving, setSaving] = useState(false);
  // 서버 렌더에는 localStorage 가 없다. 하이드레이션 이후에만 읽어
  // 서버/클라이언트 첫 렌더를 같게 맞춘다 (effect 로 되돌릴 필요가 없다).
  const hydrated = useHydrated();
  const stored = useMemo(() => (hydrated ? readStoredAccent() : DEFAULT_ACCENT), [hydrated]);
  const [picked, setPicked] = useState<string | null>(null);
  const activeAccent = picked ?? stored;

  function pickAccent(value: string) {
    setPicked(value);
    storeAccent(value);
  }

  const outroSlide: InstagramSlide = {
    slide_number: post.slides.length + 1,
    layout: 'outro',
    headline: '매주 수요일 저녁,\n*메이커스 노트*',
    body: '뉴스레터를 통해\n매주 새로운 소식을 받아보세요',
    cta: "프로필 링크 또는 '메이커스노트'를 검색",
    handle: 'maily.so/makersnote',
    background_color: PAPER,
    accent_color: activeAccent,
  };

  const slides = [...post.slides, outroSlide];
  const total = slides.length;
  const slide = slides[current];

  /** 웹폰트가 준비되기 전에 그리면 PNG 만 시스템 폰트로 나온다 */
  async function save(target: InstagramSlide, i: number) {
    await waitForCardFonts();
    triggerDownload(buildCanvas(target, i, total, activeAccent), `instagram-slide-${i + 1}.png`);
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
        triggerDownload(buildCanvas(slides[i], i, total, activeAccent), `instagram-slide-${i + 1}.png`);
        await new Promise((r) => setTimeout(r, 350));
      }
    } finally {
      setSaving(false);
    }
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
          05 · Instagram
        </h3>
        <span className="flex-1 h-0.5 opacity-30 min-w-4" style={{ background: '#6e1b33' }} />
        <span className="text-[11px] tracking-wider tabular-nums text-[var(--soft)] shrink-0">
          {total}장
        </span>
      </div>

      <div className="pl-3.5 border-l-[3px] min-w-0" style={{ borderColor: '#6e1b33' }}>
        <div className="max-w-[420px]">
          <SlidePreview slide={slide} index={current} total={total} accent={activeAccent} />
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
              const on = activeAccent === a.value;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => pickAccent(a.value)}
                  aria-label={a.label}
                  aria-pressed={on}
                  title={a.label}
                  className={`w-5 h-5 rounded-full transition-transform ${on ? 'scale-110' : 'hover:scale-105'}`}
                  style={{
                    background: a.value,
                    boxShadow: on ? `0 0 0 2px var(--paper), 0 0 0 4px ${a.value}` : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3.5 pt-2.5 border-t border-[var(--hair)]">
          <button
            type="button"
            onClick={handleDownloadCurrent}
            disabled={saving}
            className="border-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--card)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-transparent hover:text-[var(--ink)] active:scale-[0.98] disabled:opacity-40 transition-all min-w-[96px]"
          >
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
