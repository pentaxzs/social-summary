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

/* ─── Canvas: Cover layout ─── */

function drawCover(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number) {
  const tc = getTextColor(slide.background_color);
  const sc = secondary(tc);
  const PAD = 96;

  ctx.textBaseline = 'top';

  const HL = 100, HL_LH = 122;
  ctx.font = `900 ${HL}px ${F}`;
  const hlLines = splitLines(ctx, slide.headline, S - PAD * 2, 3);

  const labelH  = slide.label ? 36 + 28 : 0;
  const hlH     = hlLines.length * HL_LH;
  const divH    = 52 + 5 + 52;
  const bodyH   = slide.body ? 44 : 0;
  const totalH  = labelH + hlH + divH + bodyH;
  let y = Math.max(80, Math.round((S - totalH) / 2));

  if (slide.label) {
    ctx.font = `500 36px ${F}`;
    ctx.fillStyle = slide.accent_color;
    ctx.textAlign = 'center';
    ctx.fillText(slide.label, S / 2, y);
    y += 36 + 28;
  }

  ctx.font = `900 ${HL}px ${F}`;
  ctx.fillStyle = tc;
  ctx.textAlign = 'center';
  hlLines.forEach((line, i) => ctx.fillText(line, S / 2, y + i * HL_LH));
  y += hlH + 52;

  ctx.fillStyle = slide.accent_color;
  ctx.fillRect(S / 2 - 64, y, 128, 5);
  y += 5 + 52;

  if (slide.body) {
    ctx.font = `400 44px ${F}`;
    ctx.fillStyle = sc;
    ctx.textAlign = 'center';
    wrapText(ctx, slide.body, S - PAD * 2.5, 2).forEach((line, i) => {
      ctx.fillText(line, S / 2, y + i * 58);
    });
  }
}

/* ─── Canvas: Content layout (with emoji marker) ─── */

function drawContent(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number, index: number) {
  const tc = getTextColor(slide.background_color);
  const sc = secondary(tc);
  const LEFT = 90, PAD = 90;
  const emoji = getKeywordEmoji(slide.keyword, index);

  // ── Measure all blocks first for vertical centering ──
  const KW_FS = 34, EMOJI_FS = 48;
  const HL = 82, HL_LH = 102;
  const BODY_FS = 40, BODY_LH = BODY_FS + 14;

  ctx.font = `900 ${HL}px ${F}`;
  const hlLines = splitLines(ctx, slide.headline, S - PAD * 2, 3);
  const hlH = hlLines.length * HL_LH;

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

  // Block heights: [emoji+keyword row] + gap + headline + divider + body
  const kwRowH = Math.max(EMOJI_FS, KW_FS) + 4; // emoji and keyword are same line
  const totalH = kwRowH + 40 + hlH + 36 + 4 + 36 + bodyH;
  let y = Math.max(80, Math.round((S - totalH) / 2));

  ctx.textBaseline = 'top';

  // ── Emoji + Keyword inline (left-aligned) ──
  // Draw emoji
  ctx.font = `${EMOJI_FS}px serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const emojiMidY = y + kwRowH / 2;
  ctx.fillText(emoji, LEFT, emojiMidY);

  // Draw keyword text next to emoji
  if (slide.keyword) {
    const emojiW = ctx.measureText(emoji).width;
    ctx.font = `700 ${KW_FS}px ${F}`;
    ctx.fillStyle = slide.accent_color;
    ctx.textBaseline = 'middle';
    ctx.fillText(slide.keyword, LEFT + emojiW + 16, emojiMidY);
  }

  y += kwRowH + 40;

  // ── Headline ──
  ctx.font = `900 ${HL}px ${F}`;
  ctx.fillStyle = tc;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  hlLines.forEach((line, i) => ctx.fillText(line, LEFT, y + i * HL_LH));
  y += hlH + 36;

  // ── Divider ──
  ctx.fillStyle = slide.accent_color;
  ctx.fillRect(LEFT, y, 72, 4);
  y += 4 + 36;

  // ── Body ──
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

  // Sparkline background (decorative)
  ctx.save();
  ctx.strokeStyle = hexToRgba(slide.accent_color, 0.20);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(60, S * 0.82);
  ctx.bezierCurveTo(S * 0.25, S * 0.70, S * 0.40, S * 0.78, S * 0.55, S * 0.68);
  ctx.bezierCurveTo(S * 0.70, S * 0.58, S * 0.82, S * 0.50, S - 60, S * 0.36);
  ctx.stroke();
  ctx.restore();

  ctx.textBaseline = 'alphabetic';

  // Badge pill (top-left) — with stat emoji
  const statEmoji = getStatEmoji(slide.stat_unit);
  if (slide.stat_badge) {
    const FS = 30, PX = 22, PY = 12;
    ctx.font = `700 ${FS}px ${F}`;
    const badgeText = `${statEmoji}  ${slide.stat_badge}`;
    const bw = ctx.measureText(badgeText).width + PX * 2;
    const bh = FS + PY * 2;
    ctx.fillStyle = slide.accent_color;
    roundRect(ctx, 80, 80, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = slide.background_color;
    ctx.textAlign = 'left';
    ctx.fillText(badgeText, 80 + PX, 80 + PY + FS * 0.8);
  }

  // Stat value + unit
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

  if (slide.headline) {
    ctx.textBaseline = 'top';
    ctx.font = `400 46px ${F}`;
    ctx.fillStyle = tc;
    ctx.textAlign = 'center';
    wrapText(ctx, slide.headline, S - 160, 2).forEach((line, i) => {
      ctx.fillText(line, S / 2, baseY + 70 + i * 62);
    });
  }

  if (slide.source) {
    ctx.textBaseline = 'alphabetic';
    ctx.font = `400 28px ${F}`;
    ctx.fillStyle = sc;
    ctx.textAlign = 'left';
    ctx.fillText(`SOURCE · ${slide.source}`, 80, S - 80);
  }
}

/* ─── Canvas: Outro layout ─── */

function drawOutro(ctx: CanvasRenderingContext2D, slide: InstagramSlide, S: number) {
  const tc = getTextColor(slide.background_color);
  const sc = secondary(tc);
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
  const bodyLines = splitLines(ctx, '뉴스레터에서 새로운 이야기를 보냅니다 ✉️', S - 180, 2);
  bodyLines.forEach((line, i) => ctx.fillText(line, cx, y + i * 62));
  y += bodyLines.length * 62 + 38;

  ctx.font = `400 34px ${F}`;
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.fillText('프로필 링크 또는', cx, y);
  y += 34 + 8;
  ctx.fillText("'메이커스노트'를 검색해보세요.", cx, y);

  ctx.textBaseline = 'bottom';
  ctx.font = `500 38px ${F}`;
  ctx.fillStyle = hexToRgba(accent, 0.92);
  ctx.fillText('maily.so/makersnote', cx, S - 100);
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
  else if (layout === 'outro')   drawOutro(ctx, slide, S);
  else                           drawContent(ctx, slide, S, index);

  // Slide number (top-right) — skip for stat
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

/* ─── Slide Preview Components ─── */

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
        style={{ color: tc, fontSize: 'clamp(1.75rem, 7vw, 3.25rem)', lineHeight: 1.15, whiteSpace: 'pre-line' }}>
        {slide.headline.replace(/\\n/g, '\n')}
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
  const emoji = getKeywordEmoji(slide.keyword, index);

  return (
    <div className="w-full aspect-square relative flex flex-col overflow-hidden" style={{ background: bg }}>
      <div className="absolute top-3 right-4 text-xs" style={{ color: sc }}>{index + 1} / {total}</div>

      {/* Text content — vertically centered */}
      <div className="flex flex-col justify-center flex-1 px-7 sm:px-9 py-8">
        {/* Emoji + Keyword inline */}
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <span style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)', lineHeight: 1 }}>{emoji}</span>
          {slide.keyword && (
            <p className="text-xs sm:text-sm font-bold tracking-wider uppercase" style={{ color: accent }}>
              {slide.keyword}
            </p>
          )}
        </div>
        <h2 className="font-black leading-tight mb-2 sm:mb-3"
          style={{ color: tc, fontSize: 'clamp(1.5rem, 6vw, 2.6rem)', lineHeight: 1.18, whiteSpace: 'pre-line' }}>
          {slide.headline.replace(/\\n/g, '\n')}
        </h2>
        <div className="mb-3 sm:mb-4" style={{ background: accent, width: 40, height: 3, borderRadius: 2 }} />
        {bodyFormatted && (
          <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-line" style={{ color: sc }}>
            {bodyFormatted}
          </p>
        )}
      </div>

      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function StatPreview({ slide, index, total }: { slide: InstagramSlide; index: number; total: number }) {
  const bg = slide.background_color || '#0a0a0a';
  const accent = slide.accent_color || '#00c896';
  const tc = getTextColor(bg);
  const sc = secondary(tc);
  const statEmoji = getStatEmoji(slide.stat_unit);
  return (
    <div className="w-full aspect-square relative flex flex-col p-6 sm:p-8 overflow-hidden" style={{ background: bg }}>
      {/* Decorative sparkline */}
      <svg className="absolute bottom-0 left-0 pointer-events-none" style={{ width: '70%', height: '40%', opacity: 0.22 }}
        viewBox="0 0 300 140" preserveAspectRatio="none">
        <path d="M10 125 C60 95 110 112 150 98 C190 84 240 62 290 32"
          stroke={accent} strokeWidth="3" fill="none" strokeLinecap="round" />
        {([[10, 125], [90, 106], [150, 98], [210, 88], [290, 32]] as [number, number][]).map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="5" fill={accent} />
        ))}
      </svg>

      {slide.stat_badge && (
        <span className="self-start text-xs font-bold px-2.5 py-1 rounded mb-auto relative z-10"
          style={{ background: accent, color: bg }}>
          {statEmoji}&nbsp;&nbsp;{slide.stat_badge}
        </span>
      )}
      <div className="flex-1 flex flex-col justify-center relative z-10">
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
        <p className="text-xs relative z-10" style={{ color: sc }}>SOURCE · {slide.source}</p>
      )}
      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function OutroPreview({ slide, index, total }: { slide: InstagramSlide; index: number; total: number }) {
  const bg = slide.background_color || '#0d0d0d';
  const accent = slide.accent_color || '#00c896';
  const tc = getTextColor(bg);
  const sc = secondary(tc);
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

      <div className="absolute top-3 right-4 text-xs" style={{ color: sc, zIndex: 1 }}>{index + 1} / {total}</div>

      <div className="relative text-center flex flex-col items-center" style={{ zIndex: 1 }}>
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
          뉴스레터에서 새로운 이야기를<br />보냅니다 ✉️
        </p>
        <p className="text-center" style={{ color: 'rgba(255,255,255,0.68)', fontSize: 'clamp(0.68rem, 2.5vw, 0.88rem)' }}>
          프로필 링크 또는 &apos;메이커스노트&apos;를 검색해보세요.
        </p>
      </div>

      <p className="absolute bottom-6 text-center pointer-events-none" style={{
        color: hexToRgba(accent, 0.92),
        fontSize: 'clamp(0.75rem, 2.5vw, 0.95rem)',
        fontWeight: 500,
        zIndex: 1,
      }}>
        maily.so/makersnote
      </p>

      <Dots index={index} total={total} accent={accent} />
    </div>
  );
}

function SlidePreview({ slide, index, total }: { slide: InstagramSlide; index: number; total: number }) {
  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');
  if (layout === 'cover')  return <CoverPreview   slide={slide} index={index} total={total} />;
  if (layout === 'stat')   return <StatPreview    slide={slide} index={index} total={total} />;
  if (layout === 'outro')  return <OutroPreview   slide={slide} index={index} total={total} />;
  return                          <ContentPreview slide={slide} index={index} total={total} />;
}

/* ─── Main Component ─── */

export function InstagramCard({ post }: { post: InstagramPost }) {
  const [current, setCurrent] = useState(0);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const outroSlide: InstagramSlide = {
    slide_number: post.slides.length + 1,
    layout: 'outro',
    headline: '매주 수요일 저녁,\n메이커스노트',
    body: '뉴스레터에서 새로운 이야기를 보냅니다 ✉️',
    background_color: '#0d0d0d',
    accent_color: post.slides[0]?.accent_color || '#00c896',
  };

  const slides = [...post.slides, outroSlide];
  const total = slides.length;
  const slide = slides[current];

  function handleDownloadCurrent() {
    triggerDownload(buildCanvas(slide, current, total), `instagram-slide-${current + 1}.png`);
  }

  function handleDownloadAll() {
    slides.forEach((s, i) => {
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
        <div className="rounded-xl overflow-hidden shadow-md">
          <SlidePreview slide={slide} index={current} total={total} />
        </div>

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

        <button
          onClick={handleDownloadCurrent}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:border-fuchsia-300 hover:text-fuchsia-600 hover:bg-fuchsia-50 transition-all"
        >
          📥 현재 슬라이드 PNG 저장 (1080×1080)
        </button>
      </div>

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
