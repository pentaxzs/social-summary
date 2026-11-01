'use client';

import { useMemo, useState } from 'react';
import { InstagramPost, InstagramSlide } from '@/lib/types';
import { CANVAS_HEAD, CANVAS_BODY, waitForCardFonts } from '@/lib/fonts';
import { CARD_ACCENTS, DEFAULT_ACCENT, readStoredAccent, storeAccent } from '@/lib/card-theme';
import { useHydrated } from '@/lib/use-hydrated';
import {
  parseHeadline,
  jittersFor,
  stripEmphasis,
  fitScale,
  EMPHASIS_SCALE,
  TextRun,
  JitterStrength,
} from '@/lib/handwriting';

/* ─────────────────────────────────────────────
 * 고정 팔레트.
 * 손글씨 카드뉴스는 캐러셀 전체가 한 벌로 읽혀야 힘이 생긴다.
 * 그래서 슬라이드마다 AI 가 고른 background_color / accent_color 는
 * 이 컴포넌트에서 쓰지 않는다 (사진 배경을 쓰는 InstagramPhotoCard 는 그대로).
 * ───────────────────────────────────────────── */
const PAPER = '#f5f2ec';
const INK = '#4a3426';
const INK_SOFT = '#5c4435';
const INK_FAINT = '#8d7866';

const S = 1080; // 인스타 1:1 기준 해상도
const SIDE_PAD = 0.075; // 좌우 여백 비율. 미리보기의 7.5cqw 와 같아야 한다
const TEXT_UNITS = (1 - SIDE_PAD * 2) / 1; // 본문 영역을 '글자 폭' 단위로 환산할 때 쓰는 분자

/** 헤드라인 기준 크기 (1080 기준 px). 미리보기는 같은 값을 cqw 로 환산해 쓴다 */
const HEAD_SIZE = { cover: 138, content: 128, outro: 104 } as const;
const pxToCqw = (px: number) => (px / S) * 100;

/* ─── Canvas: 글자별 흔들림 + 강조 ─── */

interface CharSpec {
  ch: string;
  size: number;
  color: string;
}

function toChars(runs: TextRun[], baseSize: number, accent: string): CharSpec[] {
  const out: CharSpec[] = [];
  for (const run of runs) {
    const size = run.emphasis ? baseSize * EMPHASIS_SCALE : baseSize;
    const color = run.emphasis ? accent : INK;
    for (const ch of run.text) out.push({ ch, size, color });
  }
  return out;
}

function measureChars(ctx: CanvasRenderingContext2D, chars: CharSpec[], family: string): number {
  let w = 0;
  for (const c of chars) {
    ctx.font = `${c.size}px "${family}"`;
    w += ctx.measureText(c.ch).width;
  }
  return w;
}

/** 가운데 정렬로 한 줄을 그린다. baselineY 는 글자 밑선 */
function drawChars(
  ctx: CanvasRenderingContext2D,
  chars: CharSpec[],
  seedText: string,
  strength: JitterStrength,
  cx: number,
  baselineY: number,
  family: string,
) {
  const jitters = jittersFor(seedText, chars.length, strength);
  const total = measureChars(ctx, chars, family);
  let x = cx - total / 2;

  chars.forEach((c, i) => {
    const j = jitters[i];
    ctx.font = `${c.size}px "${family}"`;
    const w = ctx.measureText(c.ch).width;
    ctx.save();
    ctx.translate(x + w / 2, baselineY + j.dy * c.size);
    ctx.rotate((j.rot * Math.PI) / 180);
    ctx.scale(j.scale, j.scale);
    ctx.fillStyle = c.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(c.ch, 0, 0);
    ctx.restore();
    x += w;
  });
}

/** 강조가 섞인 헤드라인을 여러 줄로. 그린 높이를 돌려준다 */
function drawHeadline(
  ctx: CanvasRenderingContext2D,
  raw: string,
  topY: number,
  baseSize: number,
  accent: string,
): number {
  const lines = parseHeadline(raw.replace(/\\n/g, '\n'));
  // 크게 잡아두고, 긴 줄이 나오면 그만큼 줄인다
  const size = baseSize * fitScale(lines, (S * TEXT_UNITS) / baseSize);
  const lh = size * 1.32;
  lines.forEach((runs, i) => {
    const chars = toChars(runs, size, accent);
    const seed = runs.map((r) => r.text).join('');
    drawChars(ctx, chars, seed, 'strong', S / 2, topY + lh * (i + 0.78), CANVAS_HEAD);
  });
  return lines.length * lh;
}

/** 레이아웃 높이를 미리 잴 때 쓴다 — 실제로 그려지는 줄 높이와 같아야 한다 */
function headlineHeight(raw: string, baseSize: number): number {
  const lines = parseHeadline(raw.replace(/\\n/g, '\n'));
  const size = baseSize * fitScale(lines, (S * TEXT_UNITS) / baseSize);
  return lines.length * size * 1.32;
}

/** 본문/부제. 흔들림은 약하게 */
function drawBody(
  ctx: CanvasRenderingContext2D,
  raw: string,
  topY: number,
  baseSize: number,
  color: string,
): number {
  const lines = raw.replace(/\\n/g, '\n').split('\n').filter((l) => l.trim());
  // 헤드라인과 같은 방식으로, 긴 줄이면 그만큼 줄인다
  const runs = lines.map((l) => [{ text: l, emphasis: false }]);
  const size = baseSize * fitScale(runs, (S * TEXT_UNITS) / baseSize);
  const lh = size * 1.42;
  lines.forEach((line, i) => {
    const chars = [...line].map((ch) => ({ ch, size, color }));
    drawChars(ctx, chars, line, 'soft', S / 2, topY + lh * (i + 0.76), CANVAS_BODY);
  });
  return lines.length * lh;
}

/** drawBody 와 같은 높이를 미리 잰다 */
function bodyHeight(raw: string, baseSize: number): number {
  const lines = raw.replace(/\\n/g, '\n').split('\n').filter((l) => l.trim());
  if (!lines.length) return 0;
  const runs = lines.map((l) => [{ text: l, emphasis: false }]);
  const size = baseSize * fitScale(runs, (S * TEXT_UNITS) / baseSize);
  return lines.length * size * 1.42;
}

/* ─── Canvas: 손그림 장식 ─── */

function drawSlashes(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: 1 | -1, accent: string) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (const off of [0, 26]) {
    const x = cx + dir * off;
    ctx.beginPath();
    ctx.moveTo(x, cy - 16);
    ctx.lineTo(x + dir * 20, cy);
    ctx.lineTo(x, cy + 16);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
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

/**
 * 인스타 글리프 — 둥근 사각 + 원 + 점.
 * 정석 로고의 매끈한 기하 도형 대신 모서리를 조금 흔들어, 주변 손글씨와
 * 같은 결로 보이게 한다. r 은 글리프 반지름(한 변의 절반).
 */
function drawInstaMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string) {
  const side = r * 2;
  const rad = side * 0.3;
  const x = cx - r;
  const y = cy - r;

  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(5, side * 0.105);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // 바깥 둥근 사각
  roundRect(ctx, x, y, side, side, rad);
  ctx.stroke();

  // 가운데 렌즈
  ctx.beginPath();
  ctx.arc(cx, cy, side * 0.225, 0, Math.PI * 2);
  ctx.stroke();

  // 우상단 점
  ctx.beginPath();
  ctx.arc(cx + side * 0.275, cy - side * 0.275, side * 0.055, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();
}

function drawSwoosh(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, accent: string) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.bezierCurveTo(cx - w / 4, y - 11, cx + w / 4, y - 11, cx + w / 2, y - 3);
  ctx.stroke();
  ctx.restore();
}

function drawPill(ctx: CanvasRenderingContext2D, text: string, cx: number, topY: number, accent: string): number {
  const fs = 46;
  ctx.font = `${fs}px "${CANVAS_BODY}"`;
  const w = ctx.measureText(text).width + 80;
  const h = fs + 36;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.beginPath();
  const r = h / 2;
  ctx.moveTo(cx - w / 2 + r, topY);
  ctx.lineTo(cx + w / 2 - r, topY);
  ctx.arcTo(cx + w / 2, topY, cx + w / 2, topY + r, r);
  ctx.arcTo(cx + w / 2, topY + h, cx + w / 2 - r, topY + h, r);
  ctx.lineTo(cx - w / 2 + r, topY + h);
  ctx.arcTo(cx - w / 2, topY + h, cx - w / 2, topY + r, r);
  ctx.arcTo(cx - w / 2, topY, cx - w / 2 + r, topY, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, topY + h / 2 + 2);
  ctx.restore();
  return h;
}

/* ─── Canvas: 레이아웃 4종 ─── */

function drawCover(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
  const HL = HEAD_SIZE.cover;
  const bodyLines = (slide.body || '').replace(/\\n/g, '\n').split('\n').filter((l) => l.trim()).length;

  const eyebrowH = slide.label ? 54 + 42 : 0;
  const hlH = headlineHeight(slide.headline, HL);
  const bodyH = bodyLines ? 46 + bodyLines * 66 : 0;
  let y = Math.max(140, (S - (eyebrowH + hlH + bodyH)) / 2);

  if (slide.label) {
    ctx.font = `54px "${CANVAS_BODY}"`;
    const w = ctx.measureText(slide.label).width;
    drawChars(ctx, [...slide.label].map((ch) => ({ ch, size: 54, color: INK })), slide.label, 'soft', S / 2, y + 44, CANVAS_BODY);
    // 미리보기와 같은 방향 — 빗금이 글자 쪽(안쪽)을 향한다
    drawSlashes(ctx, S / 2 - w / 2 - 92, y + 26, 1, accent);
    drawSlashes(ctx, S / 2 + w / 2 + 92, y + 26, -1, accent);
    y += eyebrowH;
  }

  y += drawHeadline(ctx, slide.headline, y, HL, accent);

  if (slide.body) {
    y += 46;
    drawBody(ctx, slide.body, y, 48, INK_SOFT);
  }

  drawInstaMark(ctx, S / 2, S - 112, 32, accent);
}

function drawContent(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
  const HL = HEAD_SIZE.content;
  const bodyLines = (slide.body || '').replace(/\\n/g, '\n').split('\n').filter((l) => l.trim()).length;

  const kwH = slide.keyword ? 82 + 40 : 0;
  const hlH = headlineHeight(slide.headline, HL);
  const bodyH = bodyLines ? 50 + bodyLines * 64 : 0;
  let y = Math.max(140, (S - (kwH + hlH + bodyH)) / 2);

  if (slide.keyword) {
    drawPill(ctx, slide.keyword, S / 2, y, accent);
    y += kwH;
  }
  y += drawHeadline(ctx, slide.headline, y, HL, accent);
  if (slide.body) {
    y += 50;
    drawBody(ctx, slide.body, y, 46, INK_SOFT);
  }
}

function drawStat(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
  const VAL = 300;
  const UNIT = 128;
  const badge = slide.stat_badge || '수치';

  let y = 250;
  drawPill(ctx, badge, S / 2, y, accent);
  y += 82 + 60;

  const value = slide.stat_value || '—';
  const unit = slide.stat_unit || '';
  ctx.font = `${VAL}px "${CANVAS_HEAD}"`;
  const vw = ctx.measureText(value).width;
  ctx.font = `${UNIT}px "${CANVAS_HEAD}"`;
  const uw = unit ? ctx.measureText(unit).width + 22 : 0;
  const startX = S / 2 - (vw + uw) / 2;

  drawChars(ctx, [...value].map((ch) => ({ ch, size: VAL, color: accent })), value, 'strong', startX + vw / 2, y + VAL * 0.82, CANVAS_HEAD);
  if (unit) {
    ctx.font = `${UNIT}px "${CANVAS_HEAD}"`;
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(unit, startX + vw + 22, y + VAL * 0.82);
  }
  y += VAL + 50;

  if (slide.headline) y += drawBody(ctx, stripEmphasis(slide.headline), y, 48, INK_SOFT);
  if (slide.source) {
    y += 26;
    drawBody(ctx, slide.source, y, 36, INK_FAINT);
  }
}

const OUTRO_BODY = 46;
const OUTRO_CTA = 44;
const OUTRO_HANDLE = 38;

function drawOutro(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
  const HL = HEAD_SIZE.outro;

  // 헤드라인 / 설명 / 밑줄 친 안내 / 별 / 주소 — 다섯 단을 먼저 재고 가운데 맞춘다
  const hlH = headlineHeight(slide.headline, HL);
  const bodyH = slide.body ? 50 + bodyHeight(slide.body, OUTRO_BODY) : 0;
  const ctaH = slide.cta ? 44 + bodyHeight(slide.cta, OUTRO_CTA) : 0;
  const starH = 96;
  const handleH = slide.handle ? 22 + bodyHeight(slide.handle, OUTRO_HANDLE) : 0;

  let y = Math.max(110, (S - (hlH + bodyH + ctaH + starH + handleH)) / 2);
  y += drawHeadline(ctx, slide.headline, y, HL, accent);

  if (slide.body) {
    y += 50;
    y += drawBody(ctx, slide.body, y, OUTRO_BODY, INK_SOFT);
  }

  if (slide.cta) {
    y += 44;
    const h = drawBody(ctx, slide.cta, y, OUTRO_CTA, INK);
    // 밑줄 폭은 가장 긴 줄에 맞춘다. 고정값이면 짧은 문구에서 튀어나온다
    ctx.font = `${OUTRO_CTA}px "${CANVAS_BODY}"`;
    const widest = Math.max(
      ...slide.cta.replace(/\\n/g, '\n').split('\n').map((l) => ctx.measureText(l.trim()).width),
    );
    drawSwoosh(ctx, S / 2, y + h + 26, Math.min(widest + 30, S - 150), accent);
    y += h;
  }

  y += 60;
  drawInstaMark(ctx, S / 2, y + 30, 30, accent);
  y += starH;

  if (slide.handle) {
    y += 22;
    drawBody(ctx, slide.handle, y, OUTRO_HANDLE, INK_FAINT);
  }
}

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

/** 글자를 하나씩 span 으로 쪼개 같은 흔들림을 입힌다 */
function Jittered({
  runs,
  strength,
  accent,
  emphasisScale = 1,
}: {
  runs: TextRun[];
  strength: JitterStrength;
  accent?: string;
  emphasisScale?: number;
}) {
  const seed = runs.map((r) => r.text).join('');
  const chars: { ch: string; em: boolean }[] = [];
  runs.forEach((r) => [...r.text].forEach((ch) => chars.push({ ch, em: r.emphasis })));
  const jitters = jittersFor(seed, chars.length, strength);

  return (
    <>
      {chars.map((c, i) => {
        const j = jitters[i];
        return (
          <span
            key={i}
            style={{
              display: c.ch === ' ' ? 'inline' : 'inline-block',
              transform:
                c.ch === ' '
                  ? undefined
                  : `rotate(${j.rot.toFixed(2)}deg) translateY(${(j.dy * 100).toFixed(2)}%) scale(${j.scale.toFixed(3)})`,
              fontSize: c.em ? `${emphasisScale}em` : undefined,
              color: c.em ? accent : undefined,
            }}
          >
            {c.ch === ' ' ? ' ' : c.ch}
          </span>
        );
      })}
    </>
  );
}

/** basePx 는 1080 기준 px. Canvas 와 같은 수식으로 cqw 를 만든다 */
function HeadlinePreview({ raw, basePx, accent }: { raw: string; basePx: number; accent: string }) {
  const lines = parseHeadline(raw.replace(/\\n/g, '\n'));
  const scaled = basePx * fitScale(lines, (S * TEXT_UNITS) / basePx);
  const size = `${pxToCqw(scaled).toFixed(2)}cqw`;
  return (
    <div style={{ fontFamily: `"${CANVAS_HEAD}", sans-serif`, fontSize: size, lineHeight: 1.32, color: INK }}>
      {lines.map((runs, i) => (
        <div key={i}>
          <Jittered runs={runs} strength="strong" accent={accent} emphasisScale={EMPHASIS_SCALE} />
        </div>
      ))}
    </div>
  );
}

function BodyPreview({ raw, basePx, color }: { raw: string; basePx: number; color: string }) {
  const lines = raw.replace(/\\n/g, '\n').split('\n').filter((l) => l.trim());
  const runs = lines.map((l) => [{ text: l, emphasis: false }]);
  const scaled = basePx * fitScale(runs, (S * TEXT_UNITS) / basePx);
  const size = `${pxToCqw(scaled).toFixed(2)}cqw`;
  return (
    <div style={{ fontFamily: `"${CANVAS_BODY}", sans-serif`, fontSize: size, lineHeight: 1.42, color }}>
      {lines.map((line, i) => (
        <div key={i}>
          <Jittered runs={[{ text: line, emphasis: false }]} strength="soft" />
        </div>
      ))}
    </div>
  );
}

const Slash = ({ flip, accent }: { flip?: boolean; accent: string }) => (
  <svg width="4.2cqw" height="3.4cqw" viewBox="0 0 20 16" style={{ transform: flip ? 'scaleX(-1)' : undefined, flex: 'none' }}>
    <g stroke={accent} strokeWidth="2.4" strokeLinecap="round">
      <path d="M3 3 L9 8" /><path d="M3 13 L9 8" /><path d="M10 3 L16 8" /><path d="M10 13 L16 8" />
    </g>
  </svg>
);

const InstaMark = ({ accent }: { accent: string }) => (
  <svg width="6cqw" height="6cqw" viewBox="0 0 24 24" aria-hidden="true">
    <g fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.5" />
      <circle cx="12" cy="12" r="4.15" />
    </g>
    <circle cx="17.05" cy="6.95" r="1.02" fill={accent} />
  </svg>
);

const Pill = ({ text, accent }: { text: string; accent: string }) => (
  <span style={{
    display: 'inline-block', background: accent, color: PAPER, borderRadius: 999,
    fontFamily: `"${CANVAS_BODY}", sans-serif`, fontSize: '4.6cqw',
    padding: '1.3cqw 4.8cqw', marginBottom: '3.4cqw',
  }}>{text}</span>
);

function CardFrame({ children, index, total, showNumber = true }: {
  children: React.ReactNode; index: number; total: number; showNumber?: boolean;
}) {
  return (
    <div
      style={{
        containerType: 'inline-size', width: '100%', aspectRatio: '1', background: PAPER,
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      }}
    >
      {showNumber && (
        <span style={{
          position: 'absolute', top: '7cqw', right: '7cqw', fontSize: '3.1cqw',
          color: INK_FAINT, fontFamily: `"${CANVAS_BODY}", sans-serif`,
        }}>{index + 1} / {total}</span>
      )}
      <div style={{ width: '100%', padding: '0 7.5cqw' }}>{children}</div>
    </div>
  );
}

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
