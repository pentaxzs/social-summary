'use client';

import { useState } from 'react';
import { InstagramPost, InstagramSlide } from '@/lib/types';
import { CANVAS_HEAD, CANVAS_BODY, waitForCardFonts } from '@/lib/fonts';
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
const ACCENT = '#2e9e63';

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

function toChars(runs: TextRun[], baseSize: number): CharSpec[] {
  const out: CharSpec[] = [];
  for (const run of runs) {
    const size = run.emphasis ? baseSize * EMPHASIS_SCALE : baseSize;
    const color = run.emphasis ? ACCENT : INK;
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
): number {
  const lines = parseHeadline(raw.replace(/\\n/g, '\n'));
  // 크게 잡아두고, 긴 줄이 나오면 그만큼 줄인다
  const size = baseSize * fitScale(lines, (S * TEXT_UNITS) / baseSize);
  const lh = size * 1.32;
  lines.forEach((runs, i) => {
    const chars = toChars(runs, size);
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
  size: number,
  color: string,
): number {
  const lines = raw.replace(/\\n/g, '\n').split('\n').filter((l) => l.trim());
  const lh = size * 1.42;
  lines.forEach((line, i) => {
    const chars = [...line].map((ch) => ({ ch, size, color }));
    drawChars(ctx, chars, line, 'soft', S / 2, topY + lh * (i + 0.76), CANVAS_BODY);
  });
  return lines.length * lh;
}

/* ─── Canvas: 손그림 장식 ─── */

function drawSlashes(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: 1 | -1) {
  ctx.save();
  ctx.strokeStyle = ACCENT;
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

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 7;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawSwoosh(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number) {
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.bezierCurveTo(cx - w / 4, y - 11, cx + w / 4, y - 11, cx + w / 2, y - 3);
  ctx.stroke();
  ctx.restore();
}

function drawPill(ctx: CanvasRenderingContext2D, text: string, cx: number, topY: number): number {
  const fs = 46;
  ctx.font = `${fs}px "${CANVAS_BODY}"`;
  const w = ctx.measureText(text).width + 80;
  const h = fs + 36;
  ctx.save();
  ctx.fillStyle = ACCENT;
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

function drawCover(ctx: CanvasRenderingContext2D, slide: InstagramSlide) {
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
    drawSlashes(ctx, S / 2 - w / 2 - 92, y + 26, 1);
    drawSlashes(ctx, S / 2 + w / 2 + 92, y + 26, -1);
    y += eyebrowH;
  }

  y += drawHeadline(ctx, slide.headline, y, HL);

  if (slide.body) {
    y += 46;
    drawBody(ctx, slide.body, y, 48, INK_SOFT);
  }

  drawStar(ctx, S / 2, S - 110, 34);
}

function drawContent(ctx: CanvasRenderingContext2D, slide: InstagramSlide) {
  const HL = HEAD_SIZE.content;
  const bodyLines = (slide.body || '').replace(/\\n/g, '\n').split('\n').filter((l) => l.trim()).length;

  const kwH = slide.keyword ? 82 + 40 : 0;
  const hlH = headlineHeight(slide.headline, HL);
  const bodyH = bodyLines ? 50 + bodyLines * 64 : 0;
  let y = Math.max(140, (S - (kwH + hlH + bodyH)) / 2);

  if (slide.keyword) {
    drawPill(ctx, slide.keyword, S / 2, y);
    y += kwH;
  }
  y += drawHeadline(ctx, slide.headline, y, HL);
  if (slide.body) {
    y += 50;
    drawBody(ctx, slide.body, y, 46, INK_SOFT);
  }
}

function drawStat(ctx: CanvasRenderingContext2D, slide: InstagramSlide) {
  const VAL = 300;
  const UNIT = 128;
  const badge = slide.stat_badge || '수치';

  let y = 250;
  drawPill(ctx, badge, S / 2, y);
  y += 82 + 60;

  const value = slide.stat_value || '—';
  const unit = slide.stat_unit || '';
  ctx.font = `${VAL}px "${CANVAS_HEAD}"`;
  const vw = ctx.measureText(value).width;
  ctx.font = `${UNIT}px "${CANVAS_HEAD}"`;
  const uw = unit ? ctx.measureText(unit).width + 22 : 0;
  const startX = S / 2 - (vw + uw) / 2;

  drawChars(ctx, [...value].map((ch) => ({ ch, size: VAL, color: ACCENT })), value, 'strong', startX + vw / 2, y + VAL * 0.82, CANVAS_HEAD);
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

function drawOutro(ctx: CanvasRenderingContext2D, slide: InstagramSlide) {
  const HL = HEAD_SIZE.outro;
  const hlH = headlineHeight(slide.headline, HL);
  const bodyLines = (slide.body || '').replace(/\\n/g, '\n').split('\n').filter((l) => l.trim()).length;
  const bodyH = bodyLines ? 54 + bodyLines * 66 : 0;

  let y = Math.max(170, (S - (hlH + bodyH)) / 2);
  y += drawHeadline(ctx, slide.headline, y, HL);

  if (slide.body) {
    y += 54;
    const BODY = 46;
    const h = drawBody(ctx, slide.body, y, BODY, INK_SOFT);
    // 밑줄 폭은 가장 긴 줄에 맞춘다. 고정값을 쓰면 짧은 문구에선 튀어나온다
    ctx.font = `${BODY}px "${CANVAS_BODY}"`;
    const widest = Math.max(
      ...slide.body.replace(/\\n/g, '\n').split('\n').map((l) => ctx.measureText(l.trim()).width),
    );
    drawSwoosh(ctx, S / 2, y + h + 34, Math.min(widest + 34, S - 180));
  }
  drawStar(ctx, S / 2, S - 110, 34);
}

/* ─── Canvas 조립 ─── */

function buildCanvas(slide: InstagramSlide, index: number, total: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);

  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');
  if (layout === 'cover') drawCover(ctx, slide);
  else if (layout === 'stat') drawStat(ctx, slide);
  else if (layout === 'outro') drawOutro(ctx, slide);
  else drawContent(ctx, slide);

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
  emphasisScale = 1,
}: {
  runs: TextRun[];
  strength: JitterStrength;
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
              color: c.em ? ACCENT : undefined,
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
function HeadlinePreview({ raw, basePx }: { raw: string; basePx: number }) {
  const lines = parseHeadline(raw.replace(/\\n/g, '\n'));
  const scaled = basePx * fitScale(lines, (S * TEXT_UNITS) / basePx);
  const size = `${pxToCqw(scaled).toFixed(2)}cqw`;
  return (
    <div style={{ fontFamily: `"${CANVAS_HEAD}", sans-serif`, fontSize: size, lineHeight: 1.32, color: INK }}>
      {lines.map((runs, i) => (
        <div key={i}>
          <Jittered runs={runs} strength="strong" emphasisScale={EMPHASIS_SCALE} />
        </div>
      ))}
    </div>
  );
}

function BodyPreview({ raw, size, color }: { raw: string; size: string; color: string }) {
  const lines = raw.replace(/\\n/g, '\n').split('\n').filter((l) => l.trim());
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

const Slash = ({ flip }: { flip?: boolean }) => (
  <svg width="4.2cqw" height="3.4cqw" viewBox="0 0 20 16" style={{ transform: flip ? 'scaleX(-1)' : undefined, flex: 'none' }}>
    <g stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round">
      <path d="M3 3 L9 8" /><path d="M3 13 L9 8" /><path d="M10 3 L16 8" /><path d="M10 13 L16 8" />
    </g>
  </svg>
);

const Star = () => (
  <svg width="4.6cqw" height="4.6cqw" viewBox="0 0 22 22">
    <path d="M11 2 L13.6 8.4 L20.4 8.8 L15.2 13.2 L17 19.8 L11 16 L5 19.8 L6.8 13.2 L1.6 8.8 L8.4 8.4 Z"
      fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const Pill = ({ text }: { text: string }) => (
  <span style={{
    display: 'inline-block', background: ACCENT, color: PAPER, borderRadius: 999,
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

function SlidePreview({ slide, index, total }: { slide: InstagramSlide; index: number; total: number }) {
  const layout = slide.layout ?? (index === 0 ? 'cover' : 'content');

  if (layout === 'stat') {
    return (
      <CardFrame index={index} total={total} showNumber={false}>
        <Pill text={slide.stat_badge || '수치'} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2cqw',
          fontFamily: `"${CANVAS_HEAD}", sans-serif`, lineHeight: 0.9 }}>
          <span style={{ fontSize: '28cqw', color: ACCENT, display: 'inline-block' }}>
            <Jittered runs={[{ text: slide.stat_value || '—', emphasis: false }]} strength="strong" />
          </span>
          {slide.stat_unit && <span style={{ fontSize: '12cqw', color: INK }}>{slide.stat_unit}</span>}
        </div>
        {slide.headline && (
          <div style={{ marginTop: '4.6cqw' }}>
            <BodyPreview raw={stripEmphasis(slide.headline)} size="4.6cqw" color={INK_SOFT} />
          </div>
        )}
        {slide.source && (
          <div style={{ marginTop: '2.4cqw' }}>
            <BodyPreview raw={slide.source} size="3.4cqw" color={INK_FAINT} />
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
            <Slash />
            <span style={{ fontFamily: `"${CANVAS_BODY}", sans-serif`, fontSize: '5cqw', color: INK }}>
              <Jittered runs={[{ text: slide.label, emphasis: false }]} strength="soft" />
            </span>
            <Slash flip />
          </div>
        )}
        <HeadlinePreview raw={slide.headline} basePx={HEAD_SIZE.cover} />
        {slide.body && (
          <div style={{ marginTop: '4.3cqw' }}>
            <BodyPreview raw={slide.body} size="4.5cqw" color={INK_SOFT} />
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '6cqw', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Star />
        </div>
      </CardFrame>
    );
  }

  if (layout === 'outro') {
    return (
      <CardFrame index={index} total={total}>
        <HeadlinePreview raw={slide.headline} basePx={HEAD_SIZE.outro} />
        {slide.body && (
          <div style={{ marginTop: '5cqw', position: 'relative', display: 'inline-block' }}>
            <BodyPreview raw={slide.body} size="4.5cqw" color={INK_SOFT} />
            <svg width="100%" height="1.4cqw" viewBox="0 0 150 10" preserveAspectRatio="none"
              style={{ position: 'absolute', left: 0, bottom: '-2.2cqw' }}>
              <path d="M3 6 C40 1, 110 1, 147 5" fill="none" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '6cqw', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <Star />
        </div>
      </CardFrame>
    );
  }

  return (
    <CardFrame index={index} total={total}>
      {slide.keyword && <Pill text={slide.keyword} />}
      <HeadlinePreview raw={slide.headline} basePx={HEAD_SIZE.content} />
      {slide.body && (
        <div style={{ marginTop: '4.6cqw' }}>
          <BodyPreview raw={slide.body} size="4.3cqw" color={INK_SOFT} />
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

  const outroSlide: InstagramSlide = {
    slide_number: post.slides.length + 1,
    layout: 'outro',
    headline: '매주 수요일 저녁,\n*메이커스노트*',
    body: '뉴스레터에서 새로운 이야기를 보냅니다',
    background_color: PAPER,
    accent_color: ACCENT,
  };

  const slides = [...post.slides, outroSlide];
  const total = slides.length;
  const slide = slides[current];

  /** 웹폰트가 준비되기 전에 그리면 PNG 만 시스템 폰트로 나온다 */
  async function save(target: InstagramSlide, i: number) {
    await waitForCardFonts();
    triggerDownload(buildCanvas(target, i, total), `instagram-slide-${i + 1}.png`);
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
        triggerDownload(buildCanvas(slides[i], i, total), `instagram-slide-${i + 1}.png`);
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
          <SlidePreview slide={slide} index={current} total={total} />
        </div>

        <div className="flex items-center gap-4 mt-3">
          <button type="button" onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0} className={act}>← 이전</button>
          <span className="text-[11px] tabular-nums text-[var(--soft)]">{current + 1} / {total}</span>
          <button type="button" onClick={() => setCurrent(Math.min(total - 1, current + 1))}
            disabled={current === total - 1} className={act}>다음 →</button>
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
