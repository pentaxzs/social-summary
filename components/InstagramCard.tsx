'use client';

import { useState } from 'react';
import { InstagramPost, InstagramSlide } from '@/lib/types';

/* ─── Utilities ─── */

function getTextColor(hex: string): '#ffffff' | '#1a1a1a' {
  const h = (hex || '#000000').replace('#', '');
  if (h.length < 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#1a1a1a' : '#ffffff';
}

function secondary(tc: string): string {
  return tc === '#ffffff' ? 'rgba(255,255,255,0.58)' : 'rgba(0,0,0,0.42)';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 10
): string[] {
  const lines: string[] = [];
  const words = text.split(' ');
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      if (lines.length >= maxLines) return lines;
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

const F = `"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`;

/* ─── Canvas: Cover layout ─── */

function drawCover(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number) {
  const tc = getTextColor(slide.background_color);
  const sc = secondary(tc);
  const PAD = 96;

  ctx.textBaseline = 'top';

  // Measure headline
  const HL = 100, HL_LH = 122;
  ctx.font = `900 ${HL}px ${F}`;
  const hlLines = wrapText(ctx, slide.headline, S - PAD * 2, 3);

  // Calculate total block height to center it
  const labelH  = slide.label ? 36 + 28 : 0;
  const hlH     = hlLines.length * HL_LH;
  const divH    = 52 + 5 + 52;
  const bodyH   = slide.body ? 44 : 0;
  const totalH  = labelH + hlH + divH + bodyH;
  let y = Math.max(80, Math.round((S - totalH) / 2));

  // Label
  if (slide.label) {
    ctx.font = `500 36px ${F}`;
    ctx.fillStyle = slide.accent_color;
    ctx.textAlign = 'center';
    ctx.fillText(slide.label, S / 2, y);
    y += 36 + 28;
  }

  // Headline
  ctx.font = `900 ${HL}px ${F}`;
  ctx.fillStyle = tc;
  ctx.textAlign = 'center';
  hlLines.forEach((line, i) => ctx.fillText(line, S / 2, y + i * HL_LH));
  y += hlH + 52;

  // Divider
  ctx.fillStyle = slide.accent_color;
  ctx.fillRect(S / 2 - 64, y, 128, 5);
  y += 5 + 52;

  // Body
  if (slide.body) {
    ctx.font = `400 44px ${F}`;
    ctx.fillStyle = sc;
    ctx.textAlign = 'center';
    wrapText(ctx, slide.body, S - PAD * 2.5, 2).forEach((line, i) => {
      ctx.fillText(line, S / 2, y + i * 58);
    });
  }
}

/* ─── Canvas: Content layout ─── */

function drawContent(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number) {
  const tc = getTextColor(slide.background_color);
  const sc = secondary(tc);
  const LEFT = 90, PAD = 90;

  ctx.textBaseline = 'top';

  // Keyword (top-left)
  if (slide.keyword) {
    ctx.font = `700 36px ${F}`;
    ctx.fillStyle = slide.accent_color;
    ctx.textAlign = 'left';
    ctx.fillText(slide.keyword, LEFT, 96);
  }

  // Measure headline
  const HL = 86, HL_LH = 106;
  ctx.font = `900 ${HL}px ${F}`;
  const hlLines = wrapText(ctx, slide.headline, S - PAD * 2, 3);
  const hlH = hlLines.length * HL_LH;

  const BODY_FS = 42, BODY_LH = BODY_FS + 14;
  const rawBody = (slide.body || '').replace(/\\n/g, '\n');
  const bodyParagraphs = rawBody.split('\n').filter(Boolean);
  ctx.font = `400 ${BODY_FS}px ${F}`;
  const bodyLinesAll: string[] = [];
  for (const para of bodyParagraphs) {
    const wrapped = wrapText(ctx, para, S - PAD * 2, 3);
    bodyLinesAll.push(...wrapped);
    if (bodyLinesAll.length >= 5) break;
  }
  const bodyH = bodyLinesAll.length * BODY_LH;

  const divH = 40 + 4 + 40;
  const contentH = hlH + divH + bodyH;
  const topOffset = slide.keyword ? Math.max(190, (S - contentH) / 2) : Math.max(100, (S - contentH) / 2);
  let y = topOffset;

  // Headline
  ctx.font = `900 ${HL}px ${F}`;
  ctx.fillStyle = tc;
  ctx.textAlign = 'left';
  hlLines.forEach((line, i) => ctx.fillText(line, LEFT, y + i * HL_LH));
  y += hlH + 40;

  // Divider
  ctx.fillStyle = slide.accent_color;
  ctx.fillRect(LEFT, y, 80, 4);
  y += 4 + 40;

  // Body
  if (bodyLinesAll.length > 0) {
    ctx.font = `400 ${BODY_FS}px ${F}`;
    ctx.fillStyle = sc;
    ctx.textAlign = 'left';
    bodyLinesAll.forEach((line, i) => ctx.fillText(line, LEFT, y + i * BODY_LH));
  }
}

/* ─── Canvas: Stat layout ─── */

function drawStat(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number) {
  const tc = getTextColor(slide.background_color);
  const sc = secondary(tc);

  ctx.textBaseline = 'alphabetic';

  // Badge pill (top-left)
  if (slide.stat_badge) {
    const FS = 30, PX = 22, PY = 12;
    ctx.font = `700 ${FS}px ${F}`;
    const bw = ctx.measureText(slide.stat_badge).width + PX * 2;
    const bh = FS + PY * 2;
    ctx.fillStyle = slide.accent_color;
    roundRect(ctx, 80, 80, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = slide.background_color;
    ctx.textAlign = 'left';
    ctx.fillText(slide.stat_badge, 80 + PX, 80 + PY + FS * 0.8);
  }

  // Large stat value + unit (same baseline, centered)
  const VAL_SIZE = 210, UNIT_SIZE = 140, GAP = 14;
  ctx.font = `900 ${VAL_SIZE}px ${F}`;
  const valW = slide.stat_value ? ctx.measureText(slide.stat_value).width : 0;
  ctx.font = `700 ${UNIT_SIZE}px ${F}`;
  const unitW = slide.stat_unit ? ctx.measureText(slide.stat_unit).width : 0;
  const totalW = valW + (slide.stat_unit ? GAP + unitW : 0);
  const startX = (S - totalW) / 2;
  const baseY = S * 0.56;

  if (slide.stat_value) {
    ctx.font = `900 ${VAL_SIZE}px ${F}`;
    ctx.fillStyle = slide.accent_color;
    ctx.textAlign = 'left';
    ctx.fillText(slide.stat_value, startX, baseY);
  }
  if (slide.stat_unit) {
    ctx.font = `700 ${UNIT_SIZE}px ${F}`;
    ctx.fillStyle = tc;
    ctx.fillText(slide.stat_unit, startX + valW + GAP, baseY + (VAL_SIZE - UNIT_SIZE) * 0.38);
  }

  // Headline (stat description)
  if (slide.headline) {
    ctx.textBaseline = 'top';
    ctx.font = `400 46px ${F}`;
    ctx.fillStyle = tc;
    ctx.textAlign = 'center';
    wrapText(ctx, slide.headline, S - 160, 2).forEach((line, i) => {
      ctx.fillText(line, S / 2, baseY + 70 + i * 62);
    });
  }

  // Source (bottom-left)
  if (slide.source) {
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 28px ${F}`;
    ctx.fillStyle = sc;
    ctx.textAlign = 'left';
    ctx.fillText(`SOURCE · ${slide.source}`, 80, S - 80);
  }
}

/* ─── Compose full canvas ─── */

function buildCanvas(slide: InstagramSlide, index: number, total: number): HTMLCanvasElement {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = slide.background_color || '#1e3a5f';
  ctx.fillRect(0, 0, S, S);

  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');
  if (layout === 'cover')        drawCover(ctx, slide, S);
  else if (layout === 'stat')    drawStat(ctx, slide, S);
  else                           drawContent(ctx, slide, S);

  // Slide number (top-right) — skip for stat (has badge)
  if (layout !== 'stat') {
    ctx.textBaseline = 'top';
    ctx.font = `400 30px ${F}`;
    ctx.fillStyle = secondary(getTextColor(slide.background_color));
    ctx.textAlign = 'right';
    ctx.fillText(`${index + 1} / ${total}`, S - 72, 72);
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

/* ─── Browser Preview Components ─── */

function Dots({ index, total, accent }: { index: number; total: number; accent: string }) {
  return (
    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="rounded-full transition-all duration-200"
          style={{ width: i === index ? 16 : 8, height: 8, background: i === index ? accent : 'rgba(255,255,255,0.3)' }} />
      ))}
    </div>
  );
}

function CoverPreview({ slide, index, total }: { slide: InstagramSlide; index: number; total: number }) {
  const bg = slide.background_color || '#1e3a5f';
  const accent = slide.accent_color || '#60a5fa';
  const tc = getTextColor(bg);
  const sc = secondary(tc);
  return (
    <div className="w-full aspect-square relative flex flex-col items-center justify-center px-8 sm:px-12 overflow-hidden" style={{ background: bg }}>
      <div className="absolute top-3 right-4 text-xs" style={{ color: sc }}>{index + 1} / {total}</div>
      {slide.label && (
        <p className="text-xs sm:text-sm font-medium tracking-widest mb-2" style={{ color: accent }}>
          {slide.label}
        </p>
      )}
      <h1 className="font-black text-center mb-3 sm:mb-4"
        style={{ color: tc, fontSize: 'clamp(1.75rem, 7vw, 3.25rem)', lineHeight: 1.15 }}>
        {slide.headline}
      </h1>
      <div className="mb-3" style={{ background: accent, width: 72, height: 4, borderRadius: 2 }} />
      {slide.body && (
        <p className="text-xs sm:text-sm text-center leading-relaxed" style={{ color: sc }}>
          {slide.body}
        </p>
      )}
      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function ContentPreview({ slide, index, total }: { slide: InstagramSlide; index: number; total: number }) {
  const bg = slide.background_color || '#1e3a5f';
  const accent = slide.accent_color || '#60a5fa';
  const tc = getTextColor(bg);
  const sc = secondary(tc);
  const bodyFormatted = (slide.body || '').replace(/\\n/g, '\n');
  return (
    <div className="w-full aspect-square relative flex flex-col justify-center px-7 sm:px-9 overflow-hidden" style={{ background: bg }}>
      <div className="absolute top-3 right-4 text-xs" style={{ color: sc }}>{index + 1} / {total}</div>
      {slide.keyword && (
        <p className="text-xs font-bold tracking-wider uppercase mb-3 sm:mb-4" style={{ color: accent }}>
          {slide.keyword}
        </p>
      )}
      <h2 className="font-black leading-tight mb-2 sm:mb-3"
        style={{ color: tc, fontSize: 'clamp(1.55rem, 6.5vw, 2.75rem)', lineHeight: 1.18 }}>
        {slide.headline}
      </h2>
      <div className="mb-3 sm:mb-4" style={{ background: accent, width: 44, height: 3, borderRadius: 2 }} />
      {bodyFormatted && (
        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line" style={{ color: sc }}>
          {bodyFormatted}
        </p>
      )}
      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function StatPreview({ slide, index, total }: { slide: InstagramSlide; index: number; total: number }) {
  const bg = slide.background_color || '#0a0a0a';
  const accent = slide.accent_color || '#00c896';
  const tc = getTextColor(bg);
  const sc = secondary(tc);
  return (
    <div className="w-full aspect-square relative flex flex-col p-6 sm:p-8 overflow-hidden" style={{ background: bg }}>
      {slide.stat_badge && (
        <span className="self-start text-xs font-bold px-2.5 py-1 rounded mb-auto"
          style={{ background: accent, color: bg }}>
          {slide.stat_badge}
        </span>
      )}
      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-end gap-1 sm:gap-1.5 mb-2 sm:mb-3">
          <span className="font-black leading-none"
            style={{ color: accent, fontSize: 'clamp(3.25rem, 16vw, 6.5rem)' }}>
            {slide.stat_value}
          </span>
          {slide.stat_unit && (
            <span className="font-bold mb-0.5"
              style={{ color: tc, fontSize: 'clamp(2rem, 10vw, 4rem)' }}>
              {slide.stat_unit}
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base font-medium" style={{ color: tc }}>{slide.headline}</p>
        {slide.body && (
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: sc }}>{slide.body}</p>
        )}
      </div>
      {slide.source && (
        <p className="text-xs" style={{ color: sc }}>SOURCE · {slide.source}</p>
      )}
      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function SlidePreview({ slide, index, total }: { slide: InstagramSlide; index: number; total: number }) {
  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');
  if (layout === 'cover') return <CoverPreview slide={slide} index={index} total={total} />;
  if (layout === 'stat')  return <StatPreview  slide={slide} index={index} total={total} />;
  return <ContentPreview slide={slide} index={index} total={total} />;
}

/* ─── Main Component ─── */

export function InstagramCard({ post }: { post: InstagramPost }) {
  const [current, setCurrent] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const total = post.slides.length;
  const slide = post.slides[current];

  function handleDownloadCurrent() {
    triggerDownload(buildCanvas(slide, current, total), `instagram-slide-${current + 1}.png`);
  }

  function handleDownloadAll() {
    post.slides.forEach((s, i) => {
      setTimeout(() => triggerDownload(buildCanvas(s, i, total), `instagram-slide-${i + 1}.png`), i * 400);
    });
  }

  async function handleCopyCaption() {
    await navigator.clipboard.writeText(post.caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  }

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-fuchsia-50 to-white border-fuchsia-200 shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-fuchsia-200">
        <span className="text-sm sm:text-base font-bold px-3 py-1 rounded-full bg-fuchsia-100 text-fuchsia-700">
          📸 Instagram
        </span>
        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-fuchsia-300 hover:text-fuchsia-600 active:scale-95 transition-all shadow-sm"
        >
          ⬇️ 전체 다운로드
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* 슬라이드 미리보기 */}
        <div className="rounded-xl overflow-hidden shadow-md">
          <SlidePreview slide={slide} index={current} total={total} />
        </div>

        {/* 네비게이션 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm disabled:opacity-30 hover:bg-fuchsia-50 hover:text-fuchsia-600 transition-all"
          >
            ← 이전
          </button>
          <span className="text-xs text-gray-400 tabular-nums">{current + 1} / {total}장</span>
          <button
            onClick={() => setCurrent(Math.min(total - 1, current + 1))}
            disabled={current === total - 1}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm disabled:opacity-30 hover:bg-fuchsia-50 hover:text-fuchsia-600 transition-all"
          >
            다음 →
          </button>
        </div>

        {/* 현재 슬라이드 PNG 저장 */}
        <button
          onClick={handleDownloadCurrent}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-fuchsia-300 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all"
        >
          📥 현재 슬라이드 PNG 저장 (1080×1080)
        </button>
      </div>

      {/* 본문 캡션 */}
      <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-fuchsia-100">
        <div className="flex items-center justify-between pt-3 mb-2">
          <span className="text-sm font-semibold text-gray-700">본문 캡션</span>
          <button
            onClick={handleCopyCaption}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-fuchsia-300 hover:text-fuchsia-600 active:scale-95 transition-all shadow-sm"
          >
            {copiedCaption ? '✅ 복사됨!' : '📋 복사'}
          </button>
        </div>
        <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl p-3">
          {post.caption}
        </p>
        <p className="text-xs text-gray-400 text-right mt-1 tabular-nums">{post.caption.length}자</p>
      </div>
    </div>
  );
}
