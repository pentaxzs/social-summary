/**
 * 카드 렌더 공용 모듈.
 *
 * 인스타 카드와 사진 카드가 같은 타이포·장식을 쓴다. 한쪽에만 고치면
 * 미리보기와 내려받은 PNG 가 갈라지므로 여기 한 곳에 둔다.
 */
import {
  parseHeadline,
  jittersFor,
  fitScale,
  EMPHASIS_SCALE,
  stripEmphasis,
  TextRun,
  JitterStrength,
} from '@/lib/handwriting';
import { CANVAS_HEAD, CANVAS_BODY } from '@/lib/fonts';
import { InstagramSlide } from '@/lib/types';

export const PAPER = '#f5f2ec';
export const INK = '#4a3426';
export const INK_SOFT = '#5c4435';
export const INK_FAINT = '#8d7866';

export const S = 1080; // 인스타 1:1 기준 해상도
export const SIDE_PAD = 0.075; // 좌우 여백 비율. 미리보기의 7.5cqw 와 같아야 한다
export const TEXT_UNITS = (1 - SIDE_PAD * 2) / 1; // 본문 영역을 '글자 폭' 단위로 환산할 때 쓰는 분자

/** 헤드라인 기준 크기 (1080 기준 px). 미리보기는 같은 값을 cqw 로 환산해 쓴다 */
export const HEAD_SIZE = { cover: 138, content: 128, outro: 104 } as const;
export const pxToCqw = (px: number) => (px / S) * 100;

/* ─── Canvas: 글자별 흔들림 + 강조 ─── */

export interface CharSpec {
  ch: string;
  size: number;
  color: string;
}

export function toChars(runs: TextRun[], baseSize: number, accent: string): CharSpec[] {
  const out: CharSpec[] = [];
  for (const run of runs) {
    const size = run.emphasis ? baseSize * EMPHASIS_SCALE : baseSize;
    const color = run.emphasis ? accent : INK;
    for (const ch of run.text) out.push({ ch, size, color });
  }
  return out;
}

export function measureChars(ctx: CanvasRenderingContext2D, chars: CharSpec[], family: string): number {
  let w = 0;
  for (const c of chars) {
    ctx.font = `${c.size}px "${family}"`;
    w += ctx.measureText(c.ch).width;
  }
  return w;
}

/** 가운데 정렬로 한 줄을 그린다. baselineY 는 글자 밑선 */
export function drawChars(
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
export function drawHeadline(
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
export function headlineHeight(raw: string, baseSize: number): number {
  const lines = parseHeadline(raw.replace(/\\n/g, '\n'));
  const size = baseSize * fitScale(lines, (S * TEXT_UNITS) / baseSize);
  return lines.length * size * 1.32;
}

/** 본문/부제. 흔들림은 약하게 */
export function drawBody(
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
export function bodyHeight(raw: string, baseSize: number): number {
  const lines = raw.replace(/\\n/g, '\n').split('\n').filter((l) => l.trim());
  if (!lines.length) return 0;
  const runs = lines.map((l) => [{ text: l, emphasis: false }]);
  const size = baseSize * fitScale(runs, (S * TEXT_UNITS) / baseSize);
  return lines.length * size * 1.42;
}

/* ─── Canvas: 손그림 장식 ─── */

export function drawSlashes(ctx: CanvasRenderingContext2D, cx: number, cy: number, dir: 1 | -1, accent: string) {
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

export function roundRect(
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
export function drawInstaMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, accent: string) {
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

export function drawSwoosh(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, accent: string) {
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

export function drawPill(ctx: CanvasRenderingContext2D, text: string, cx: number, topY: number, accent: string): number {
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


/** 마무리 카드의 단별 기준 크기 (1080 기준 px) */
export const OUTRO_BODY = 46;
export const OUTRO_CTA = 44;
export const OUTRO_HANDLE = 38;

/* ─── Canvas: 레이아웃 4종 ─── */

export function drawCover(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
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

export function drawContent(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
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

export function drawStat(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
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

export function drawOutro(ctx: CanvasRenderingContext2D, slide: InstagramSlide, accent: string) {
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

