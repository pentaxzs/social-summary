'use client';

import { useState } from 'react';
import { InstagramPhotoPost, InstagramPhotoSlide, InstagramSlide } from '@/lib/types';

/* ─── Utilities ─── */

function hexToRgba(hex: string, alpha: number): string {
  const h = (hex || '#000000').replace('#', '');
  if (h.length < 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const F = `"Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`;

/* ─── Emoji helpers ─── */

const KEYWORD_EMOJI_MAP: [string[], string][] = [
  [['배경', '역사', '기원', '히스토리', '유래'], '📖'],
  [['핵심', '포인트', '요점', '주요', '중요'], '💡'],
  [['결론', '마무리', '요약', '정리', 'cta', '저장'], '✅'],
  [['전망', '미래', '앞으로', '예측', '방향'], '🚀'],
  [['분석', '해석', '인사이트', '이해'], '🔍'],
  [['방법', '전략', '방식', '솔루션', '해결', '접근'], '🎯'],
  [['영향', '효과', '임팩트', '결과'], '⚡'],
  [['데이터', '수치', '통계', '숫자', '지표'], '📊'],
  [['기술', 'ai', '인공지능', 'tech', '도구'], '⚙️'],
  [['트렌드', '동향', '현황', '변화', '흐름'], '🔄'],
  [['문제', '이슈', '과제', '도전', '한계'], '⚠️'],
  [['사람', '팀', '조직', '인재', '커뮤니티'], '👥'],
  [['돈', '비용', '투자', '수익', '경제', '금융'], '💰'],
  [['시간', '속도', '기간', '일정', '프로세스'], '⏱️'],
  [['성장', '증가', '개선', '발전'], '📈'],
  [['아이디어', '혁신', '창의', '상상'], '✨'],
  [['글로벌', '세계', '해외', '국제'], '🌐'],
  [['디자인', '브랜드', '비주얼'], '🎨'],
  [['콘텐츠', '미디어', '소셜', '채널'], '📱'],
];

const FALLBACK_EMOJIS = ['✨', '💡', '🚀', '🎯', '⚡', '🔍', '📖', '🔄', '📊', '🌐'];

function getKeywordEmoji(keyword: string | undefined, index: number): string {
  if (keyword) {
    const k = keyword.toLowerCase();
    for (const [keys, emoji] of KEYWORD_EMOJI_MAP) {
      if (keys.some(key => k.includes(key))) return emoji;
    }
  }
  return FALLBACK_EMOJIS[index % FALLBACK_EMOJIS.length];
}

function getStatEmoji(unit?: string): string {
  if (!unit) return '📈';
  const u = unit.toLowerCase();
  if (u === '%') return '📊';
  if (['원', '억', '만', '달러', '$'].some(s => u.includes(s))) return '💰';
  if (['분', '시간', '초', 'h', 'min'].some(s => u.includes(s))) return '⏱️';
  if (['명', '개', '곳'].some(s => u.includes(s))) return '👥';
  if (['배'].some(s => u.includes(s))) return '📈';
  return '📊';
}

/* ─── Image loading helper ─── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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

function splitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const result: string[] = [];
  const segments = text.replace(/\\n/g, '\n').split('\n').filter(s => s.trim());
  for (const seg of segments) {
    const wrapped = wrapText(ctx, seg.trim(), maxWidth, maxLines - result.length);
    result.push(...wrapped);
    if (result.length >= maxLines) break;
  }
  return result.slice(0, maxLines);
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

/* ─── Canvas drawing: Photo background + scrim ─── */

function drawPhotoBackground(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  S: number
) {
  // Cover-fill: crop to square center
  const scale = Math.max(S / img.width, S / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
}

function drawScrim(ctx: CanvasRenderingContext2D, S: number, opacity = 0.55) {
  const grad = ctx.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, `rgba(0,0,0,${opacity * 0.3})`);
  grad.addColorStop(0.4, `rgba(0,0,0,${opacity * 0.5})`);
  grad.addColorStop(1, `rgba(0,0,0,${opacity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
}

/* ─── Canvas: Photo Cover ─── */

function drawPhotoCover(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number) {
  // Text at bottom, white on dark scrim
  const accent = slide.accent_color || '#7ecef4';
  const PAD = 72;

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Headline: 2 lines at bottom
  const HL = 90, HL_LH = 108;
  ctx.font = `900 ${HL}px ${F}`;
  const hlLines = splitLines(ctx, slide.headline, S - PAD * 2, 3);

  // Position from bottom
  const bottomY = S - 80;
  const startY = bottomY - (hlLines.length - 1) * HL_LH;

  hlLines.forEach((line, i) => {
    ctx.fillStyle = i === hlLines.length - 1 ? accent : '#ffffff';
    ctx.fillText(line, PAD, startY + i * HL_LH);
  });

  // Slide counter (top-right pill)

}

/* ─── Canvas: Photo Content ─── */

function drawPhotoContent(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number, index: number) {
  const accent = slide.accent_color || '#7ecef4';
  const emoji = getKeywordEmoji(slide.keyword, index);

  // Measure for centering
  const KW_FS = 34, EMOJI_FS = 48;
  const HL = 72, HL_LH = 88;
  const BODY_FS = 40, BODY_LH = 56;

  ctx.font = `900 ${HL}px ${F}`;
  const hlLines = splitLines(ctx, slide.headline, S - 160, 3);
  const hlH = hlLines.length * HL_LH;

  const rawBody = (slide.body || '').replace(/\\n/g, '\n');
  ctx.font = `400 ${BODY_FS}px ${F}`;
  const bodyLines: string[] = [];
  for (const para of rawBody.split('\n').filter(Boolean)) {
    bodyLines.push(...wrapText(ctx, para, S - 160, 4 - bodyLines.length));
    if (bodyLines.length >= 4) break;
  }
  const bodyH = bodyLines.length * BODY_LH;

  const kwRowH = Math.max(EMOJI_FS, KW_FS) + 4;
  const totalH = kwRowH + 32 + hlH + 28 + bodyH;
  let y = Math.max(120, Math.round((S - totalH) / 2));

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Emoji + keyword
  const emojiMidY = y + kwRowH / 2;
  ctx.font = `${EMOJI_FS}px serif`;
  if (slide.keyword) {
    ctx.font = `700 ${KW_FS}px ${F}`;
    const kwW = ctx.measureText(slide.keyword).width;
    ctx.font = `${EMOJI_FS}px serif`;
    const emojiW = ctx.measureText(emoji).width;
    const rowW = emojiW + 16 + kwW;
    const startX = (S - rowW) / 2;
    ctx.fillText(emoji, startX + emojiW / 2, emojiMidY);
    ctx.font = `700 ${KW_FS}px ${F}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(slide.keyword, startX + emojiW + 16 + kwW / 2, emojiMidY);
  } else {
    ctx.fillText(emoji, S / 2, emojiMidY);
  }
  y += kwRowH + 32;

  // Headline
  ctx.font = `900 ${HL}px ${F}`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  hlLines.forEach((line, i) => ctx.fillText(line, S / 2, y + i * HL_LH));
  y += hlH + 28;

  // Body
  if (bodyLines.length > 0) {
    ctx.font = `400 ${BODY_FS}px ${F}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    bodyLines.forEach((line, i) => ctx.fillText(line, S / 2, y + i * BODY_LH));
  }


}

/* ─── Canvas: Photo Stat ─── */

function drawPhotoStat(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number) {
  const accent = slide.accent_color || '#00c896';
  const statEmoji = getStatEmoji(slide.stat_unit);

  ctx.textBaseline = 'alphabetic';

  // Badge pill (top-left)
  if (slide.stat_badge) {
    const FS = 30, PX = 22, PY = 12;
    ctx.font = `700 ${FS}px ${F}`;
    const badgeText = `${statEmoji}  ${slide.stat_badge}`;
    const bw = ctx.measureText(badgeText).width + PX * 2;
    const bh = FS + PY * 2;
    ctx.fillStyle = accent;
    roundRect(ctx, 80, 80, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, 80 + PX, 80 + PY + FS * 0.8);
  }

  // Stat value + unit (centered)
  const VAL_SIZE = 180, UNIT_SIZE = 120, GAP = 14;
  ctx.font = `900 ${VAL_SIZE}px ${F}`;
  const valW = slide.stat_value ? ctx.measureText(slide.stat_value).width : 0;
  ctx.font = `700 ${UNIT_SIZE}px ${F}`;
  const unitW = slide.stat_unit ? ctx.measureText(slide.stat_unit).width : 0;
  const totalW = valW + (slide.stat_unit ? GAP + unitW : 0);
  const startX = (S - totalW) / 2;
  const baseY = S * 0.52;

  if (slide.stat_value) {
    ctx.font = `900 ${VAL_SIZE}px ${F}`;
    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.fillText(slide.stat_value, startX, baseY);
  }
  if (slide.stat_unit) {
    ctx.font = `700 ${UNIT_SIZE}px ${F}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(slide.stat_unit, startX + valW + GAP, baseY + (VAL_SIZE - UNIT_SIZE) * 0.38);
  }

  if (slide.headline) {
    ctx.textBaseline = 'top';
    ctx.font = `400 44px ${F}`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    wrapText(ctx, slide.headline, S - 160, 2).forEach((line, i) => {
      ctx.fillText(line, S / 2, baseY + 60 + i * 58);
    });
  }

  if (slide.source) {
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 28px ${F}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'left';
    ctx.fillText(`SOURCE · ${slide.source}`, 80, S - 80);
  }


}



/* ─── Outro (reuse text-only style) ─── */

function drawOutro(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number) {
  const accent = slide.accent_color;
  const cx = S / 2;

  ctx.save();
  ctx.filter = 'blur(60px)';
  const glowBL = ctx.createRadialGradient(S * 0.12, S * 0.88, 0, S * 0.12, S * 0.88, 460);
  glowBL.addColorStop(0, hexToRgba(accent, 0.55));
  glowBL.addColorStop(0.5, hexToRgba(accent, 0.18));
  glowBL.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glowBL;
  ctx.fillRect(0, 0, S, S);
  const glowTR = ctx.createRadialGradient(S * 0.88, S * 0.12, 0, S * 0.88, S * 0.12, 260);
  glowTR.addColorStop(0, hexToRgba(accent, 0.28));
  glowTR.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glowTR;
  ctx.fillRect(0, 0, S, S);
  ctx.filter = 'none';
  ctx.restore();

  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';

  let y = 285;

  ctx.font = `500 30px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.fillText('NEWSLETTER', cx, y);
  y += 30 + 44;

  ctx.font = `600 66px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.70)';
  ctx.fillText('매주 수요일 저녁,', cx, y);
  y += 66 + 18;

  ctx.font = `900 106px ${F}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('메이커스노트', cx, y);
  y += 106 + 46;

  ctx.font = `400 48px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  const bodyLines = splitLines(ctx, '뉴스레터를 통해 매주 새로운 소식을 받아보세요', S - 180, 2);
  bodyLines.forEach((line, i) => ctx.fillText(line, cx, y + i * 62));
  y += bodyLines.length * 62 + 44;

  ctx.font = `400 34px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.fillText("프로필 링크 또는 '메이커스노트'를 검색해보세요.", cx, y);
  y += 34 + 36;

  ctx.font = `600 38px ${F}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('maily.so/makersnote', cx, y);
}

/* ─── Build photo canvas ─── */

async function buildPhotoCanvas(
  slide: InstagramPhotoSlide,
  index: number,
  total: number
): Promise<HTMLCanvasElement> {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');

  if (layout === 'outro') {
    // Outro: solid background, no photo
    ctx.fillStyle = slide.background_color || '#0d0d0d';
    ctx.fillRect(0, 0, S, S);
    drawOutro(ctx, slide, S);
  } else {
    // Photo background
    if (slide.image_url) {
      try {
        const img = await loadImage(slide.image_url);
        drawPhotoBackground(ctx, img, S);
      } catch {
        // Fallback to solid color
        ctx.fillStyle = slide.background_color || '#1e3a5f';
        ctx.fillRect(0, 0, S, S);
      }
    } else {
      ctx.fillStyle = slide.background_color || '#1e3a5f';
      ctx.fillRect(0, 0, S, S);
    }

    // Scrim overlay
    if (layout === 'cover') {
      // Heavier scrim at bottom for cover text
      const grad = ctx.createLinearGradient(0, 0, 0, S);
      grad.addColorStop(0, 'rgba(0,0,0,0.1)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.2)');
      grad.addColorStop(0.8, 'rgba(0,0,0,0.55)');
      grad.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, S, S);
    } else {
      drawScrim(ctx, S, 0.6);
    }

    // Draw text overlay
    if (layout === 'cover')      drawPhotoCover(ctx, slide, S);
    else if (layout === 'stat')  drawPhotoStat(ctx, slide, S);
    else                         drawPhotoContent(ctx, slide, S, index);
  }

  // Slide counter (top-right pill)
  ctx.textBaseline = 'top';
  ctx.font = `500 30px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'right';
  ctx.fillText(`${index + 1}/${total}`, S - 56, 56);

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

/* Photo slide preview with image background */

function PhotoCoverPreview({ slide, index, total }: { slide: InstagramPhotoSlide; index: number; total: number }) {
  const accent = slide.accent_color || '#7ecef4';
  const hlParts = slide.headline.replace(/\\n/g, '\n').split('\n');
  return (
    <div className="w-full aspect-square relative flex flex-col justify-end overflow-hidden">
      {/* Background image */}
      {slide.image_url && (
        <img src={slide.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {!slide.image_url && (
        <div className="absolute inset-0" style={{ background: slide.background_color || '#1e3a5f' }} />
      )}
      {/* Gradient scrim — heavier at bottom */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.18) 50%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.78) 100%)',
      }} />
      {/* Counter */}
      <div className="absolute top-3 right-4 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {index + 1}/{total}
      </div>
      {/* Headline at bottom */}
      <div className="relative z-10 px-6 sm:px-8 pb-6 sm:pb-8">
        {hlParts.map((line, i) => (
          <p key={i} className="font-black leading-tight"
            style={{
              color: i === hlParts.length - 1 ? accent : '#ffffff',
              fontSize: 'clamp(1.6rem, 7vw, 3rem)',
              lineHeight: 1.15,
            }}>
            {line}
          </p>
        ))}
      </div>
      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function PhotoContentPreview({ slide, index, total }: { slide: InstagramPhotoSlide; index: number; total: number }) {
  const accent = slide.accent_color || '#7ecef4';
  const emoji = getKeywordEmoji(slide.keyword, index);
  const bodyFormatted = (slide.body || '').replace(/\\n/g, '\n');
  return (
    <div className="w-full aspect-square relative flex flex-col items-center justify-center overflow-hidden">
      {slide.image_url && (
        <img src={slide.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {!slide.image_url && (
        <div className="absolute inset-0" style={{ background: slide.background_color || '#1e3a5f' }} />
      )}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.6) 100%)',
      }} />
      <div className="absolute top-3 right-4 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {index + 1}/{total}
      </div>
      <div className="relative z-10 text-center px-7 sm:px-9">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', lineHeight: 1 }}>{emoji}</span>
          {slide.keyword && (
            <p className="text-xs sm:text-sm font-bold tracking-wider" style={{ color: '#ffffff' }}>
              {slide.keyword}
            </p>
          )}
        </div>
        <h2 className="font-black leading-tight mb-3"
          style={{ color: '#ffffff', fontSize: 'clamp(1.4rem, 5.5vw, 2.2rem)', lineHeight: 1.2, whiteSpace: 'pre-line' }}>
          {slide.headline.replace(/\\n/g, '\n')}
        </h2>
        {bodyFormatted && (
          <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line"
            style={{ color: 'rgba(255,255,255,0.75)' }}>
            {bodyFormatted}
          </p>
        )}
      </div>
      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function PhotoStatPreview({ slide, index, total }: { slide: InstagramPhotoSlide; index: number; total: number }) {
  const accent = slide.accent_color || '#00c896';
  const statEmoji = getStatEmoji(slide.stat_unit);
  return (
    <div className="w-full aspect-square relative flex flex-col p-6 sm:p-8 overflow-hidden">
      {slide.image_url && (
        <img src={slide.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {!slide.image_url && (
        <div className="absolute inset-0" style={{ background: slide.background_color || '#0a0a0a' }} />
      )}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.6) 100%)',
      }} />
      <div className="absolute top-3 right-4 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {index + 1}/{total}
      </div>
      {slide.stat_badge && (
        <span className="self-start text-xs font-bold px-2.5 py-1 rounded relative z-10 mb-auto"
          style={{ background: accent, color: '#000000' }}>
          {statEmoji}&nbsp;&nbsp;{slide.stat_badge}
        </span>
      )}
      <div className="flex-1 flex flex-col justify-center relative z-10">
        <div className="flex items-end gap-1 sm:gap-1.5 mb-2 sm:mb-3">
          <span className="font-black leading-none"
            style={{ color: accent, fontSize: 'clamp(3rem, 14vw, 5.5rem)' }}>
            {slide.stat_value}
          </span>
          {slide.stat_unit && (
            <span className="font-bold mb-0.5"
              style={{ color: '#ffffff', fontSize: 'clamp(1.8rem, 8vw, 3.5rem)' }}>
              {slide.stat_unit}
            </span>
          )}
        </div>
        <p className="text-sm sm:text-base font-medium" style={{ color: '#ffffff' }}>{slide.headline}</p>
      </div>
      {slide.source && (
        <p className="text-xs relative z-10" style={{ color: 'rgba(255,255,255,0.5)' }}>SOURCE · {slide.source}</p>
      )}
      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function OutroPreview({ slide, index, total }: { slide: InstagramPhotoSlide; index: number; total: number }) {
  const bg = slide.background_color || '#0d0d0d';
  const accent = slide.accent_color || '#00c896';
  return (
    <div className="w-full aspect-square relative flex flex-col items-center justify-center px-7 sm:px-9 overflow-hidden" style={{ background: bg }}>
      <div className="absolute bottom-0 left-0 pointer-events-none" style={{
        width: '62%', height: '62%',
        background: `radial-gradient(circle at 25% 80%, ${hexToRgba(accent, 0.55)} 0%, ${hexToRgba(accent, 0.18)} 45%, transparent 70%)`,
        filter: 'blur(40px)', zIndex: 0,
      }} />
      <div className="absolute top-0 right-0 pointer-events-none" style={{
        width: '45%', height: '45%',
        background: `radial-gradient(circle at 75% 20%, ${hexToRgba(accent, 0.28)} 0%, transparent 65%)`,
        filter: 'blur(30px)', zIndex: 0,
      }} />
      <div className="absolute top-3 right-4 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)', zIndex: 1 }}>
        {index + 1}/{total}
      </div>
      <div className="relative text-center flex flex-col items-center pb-6" style={{ zIndex: 1 }}>
        <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>
          NEWSLETTER
        </p>
        <p className="font-semibold leading-snug mb-0.5" style={{ color: 'rgba(255,255,255,0.70)', fontSize: 'clamp(1rem, 4vw, 1.65rem)' }}>
          매주 수요일 저녁,
        </p>
        <p className="font-black leading-snug mb-4" style={{ color: '#ffffff', fontSize: 'clamp(1.5rem, 6vw, 2.5rem)' }}>
          메이커스노트
        </p>
        <p className="text-center leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.88)', fontSize: 'clamp(0.78rem, 3vw, 1.05rem)' }}>
          뉴스레터를 통해 매주 새로운 소식을 받아보세요
        </p>
        <p className="text-center mb-3" style={{ color: 'rgba(255,255,255,0.68)', fontSize: 'clamp(0.68rem, 2.5vw, 0.88rem)' }}>
          프로필 링크 또는 &apos;메이커스노트&apos;를 검색해보세요.
        </p>
        <p className="text-center font-semibold" style={{ color: '#ffffff', fontSize: 'clamp(0.8rem, 2.8vw, 1rem)' }}>
          maily.so/makersnote
        </p>
      </div>
      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function PhotoSlidePreview({ slide, index, total }: { slide: InstagramPhotoSlide; index: number; total: number }) {
  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');
  if (layout === 'cover')  return <PhotoCoverPreview  slide={slide} index={index} total={total} />;
  if (layout === 'stat')   return <PhotoStatPreview   slide={slide} index={index} total={total} />;
  if (layout === 'outro')  return <OutroPreview       slide={slide} index={index} total={total} />;
  return                          <PhotoContentPreview slide={slide} index={index} total={total} />;
}

/* ─── Main Component ─── */

export function InstagramPhotoCard({ post }: { post: InstagramPhotoPost }) {
  const [current, setCurrent] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const outroSlide: InstagramPhotoSlide = {
    slide_number: post.slides.length + 1,
    layout: 'outro',
    headline: '매주 수요일 저녁,\n메이커스노트',
    body: '뉴스레터에서 새로운 이야기를 보냅니다',
    background_color: '#0d0d0d',
    accent_color: post.slides[0]?.accent_color || '#00c896',
    image_url: '',
  };

  const slides = [...post.slides, outroSlide];
  const total = slides.length;
  const slide = slides[current];

  async function handleDownloadCurrent() {
    const canvas = await buildPhotoCanvas(slide, current, total);
    triggerDownload(canvas, `instagram-photo-slide-${current + 1}.png`);
  }

  async function handleDownloadAll() {
    for (let i = 0; i < slides.length; i++) {
      const canvas = await buildPhotoCanvas(slides[i], i, total);
      triggerDownload(canvas, `instagram-photo-slide-${i + 1}.png`);
      // Small delay between downloads
      if (i < slides.length - 1) await new Promise(r => setTimeout(r, 500));
    }
  }

  async function handleCopyCaption() {
    await navigator.clipboard.writeText(post.caption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  }

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-violet-50 to-white border-violet-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-violet-200">
        <span className="text-sm sm:text-base font-bold px-3 py-1 rounded-full bg-violet-100 text-violet-700">
          🖼️ Instagram w/photo
        </span>
        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-1.5 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 active:scale-95 transition-all shadow-sm"
        >
          ⬇️ 전체 다운로드
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="rounded-xl overflow-hidden shadow-md">
          <PhotoSlidePreview slide={slide} index={current} total={total} />
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm disabled:opacity-30 hover:bg-violet-50 hover:text-violet-600 transition-all"
          >
            ← 이전
          </button>
          <span className="text-xs text-gray-400 tabular-nums">{current + 1} / {total}장</span>
          <button
            onClick={() => setCurrent(Math.min(total - 1, current + 1))}
            disabled={current === total - 1}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm disabled:opacity-30 hover:bg-violet-50 hover:text-violet-600 transition-all"
          >
            다음 →
          </button>
        </div>

        <button
          onClick={handleDownloadCurrent}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all"
        >
          📥 현재 슬라이드 PNG 저장 (1080×1080)
        </button>
      </div>

      <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-violet-100">
        <div className="flex items-center justify-between pt-3 mb-2">
          <span className="text-sm font-semibold text-gray-700">본문 캡션</span>
          <button
            onClick={handleCopyCaption}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:border-violet-300 hover:text-violet-600 active:scale-95 transition-all shadow-sm"
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
