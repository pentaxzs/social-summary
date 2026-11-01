/**
 * 사진 카드 전용 렌더.
 *
 * 손글씨 카드와 일부러 다른 결로 간다 — 굵은 모던 산세리프, 사진이 위,
 * 글은 왼쪽 정렬, 페이지 번호는 둥근 배지.
 *
 * 세로 넘침을 반드시 막는다. 앞선 버전은 텍스트 영역 높이를 고정해놓고
 * 내용이 그보다 길 때를 처리하지 않아, 위는 잘리고 아래는 사진을 침범했다.
 */
import { PHOTO_HEAD_FONT, PHOTO_BODY_FONT } from '@/lib/fonts';
import { parseHeadline, stripEmphasis, TextRun } from '@/lib/handwriting';

export const S = 1080;
export const PAD = 72;
const TEXT_W = S - PAD * 2;

/**
 * 사진 높이는 고정이 아니다. 글이 먼저고 사진이 남는 자리를 가진다.
 * 55% 로 박아두니 본문이 긴 장에서는 글이 넘쳤고, 본문이 없는 장에서는
 * 아래가 허옇게 비었다. 이제 글이 쓰는 만큼만 남기고 사진이 가져간다.
 */
export const PHOTO_H_MAX = Math.round(S * 0.72);
export const PHOTO_H_MIN = Math.round(S * 0.38);
const TEXT_GAP_TOP = 56;

const HEAD = 72;
const BODY = 40;
const GAP = 34;

export const PAPER = '#ffffff';
export const INK = '#15171a';
export const INK_SOFT = '#4a5159';
export const INK_FAINT = '#8b939c';

/* ─── 글자 단위 줄바꿈 ─── */

/** 폭에 맞춰 줄을 나눈다. 한국어는 어절 단위로 끊되 한 어절이 길면 글자로 쪼갠다 */
export function wrapToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\\n/g, '\n').split('\n')) {
    if (!para.trim()) continue;
    let line = '';
    for (const word of para.trim().split(/\s+/)) {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width <= maxWidth) {
        line = probe;
        continue;
      }
      if (line) out.push(line);
      if (ctx.measureText(word).width <= maxWidth) {
        line = word;
      } else {
        // 한 어절이 한 줄보다 길면 글자 단위로 끊는다
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            out.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

interface Block {
  lines: string[];
  size: number;
  lineHeight: number;
  color: string;
  font: string;
  /** 강조 구간이 들어간 줄의 run 정보 (헤드라인만) */
  runs?: TextRun[][];
}

/**
 * 블록들을 주어진 높이에 넣는다. 넘치면 전체를 같은 비율로 줄인다.
 * 한 블록만 줄이면 위계가 무너지므로 통째로 줄인다.
 */
function fitBlocks(blocks: Block[], gap: number, available: number): number {
  const total = blocks.reduce((h, b) => h + b.lines.length * b.lineHeight, 0)
    + gap * Math.max(0, blocks.length - 1);
  return total > available ? available / total : 1;
}


interface EmChar { ch: string; em: boolean }

/**
 * 강조 표시를 유지한 채 폭에 맞춰 줄을 나눈다.
 * 글자 단위로 들고 다니므로 구두점이 붙어도 강조가 어긋나지 않는다.
 * 줄바꿈은 가능하면 공백에서, 없으면 글자 사이에서 끊는다 (한국어 기준).
 */
function wrapChars(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[][],
  maxWidth: number,
): EmChar[][] {
  const out: EmChar[][] = [];
  for (const lineRuns of runs) {
    const chars: EmChar[] = [];
    for (const run of lineRuns) for (const ch of run.text) chars.push({ ch, em: run.emphasis });

    let line: EmChar[] = [];
    let width = 0;
    let lastSpace = -1;
    for (const c of chars) {
      const w = ctx.measureText(c.ch).width;
      if (width + w > maxWidth && line.length) {
        if (lastSpace > 0) {
          out.push(line.slice(0, lastSpace));
          line = line.slice(lastSpace + 1);
          width = line.reduce((a, x) => a + ctx.measureText(x.ch).width, 0);
        } else {
          out.push(line);
          line = [];
          width = 0;
        }
        lastSpace = -1;
      }
      if (c.ch === ' ') lastSpace = line.length;
      line.push(c);
      width += w;
    }
    if (line.length) out.push(line);
  }
  return out;
}

/* ─── 그리기 ─── */

export function drawPhotoTop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  accent: string,
  photoH: number,
) {
  if (img) {
    const scale = Math.max(S / img.width, photoH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, S, photoH);
    ctx.clip();
    ctx.drawImage(img, (S - w) / 2, (photoH - h) / 2, w, h);
    ctx.restore();
  } else {
    // 사진이 없을 때. 빈 칸으로 두지 않고 키 컬러 면으로 채운다
    ctx.save();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.14;
    ctx.fillRect(0, 0, S, photoH);
    ctx.restore();
  }
}

/** 글을 제 크기로 그렸을 때 차지하는 높이 */
function textBlockHeight(
  ctx: CanvasRenderingContext2D,
  headline: string,
  body: string | undefined,
  hasEyebrow: boolean,
): number {
  ctx.font = `${HEAD}px "${PHOTO_HEAD_FONT}"`;
  const headLines = wrapToWidth(ctx, stripEmphasis(headline), TEXT_W).length;
  ctx.font = `${BODY}px "${PHOTO_BODY_FONT}"`;
  const bodyLines = body ? wrapToWidth(ctx, body, TEXT_W).length : 0;
  return (hasEyebrow ? 34 * 1.4 + 22 : 0)
    + headLines * HEAD * 1.3
    + (bodyLines ? GAP + bodyLines * BODY * 1.58 : 0);
}

/**
 * 글이 제 크기로 들어갈 만큼만 사진에 자리를 준다.
 * 글이 짧으면 사진이 커지고, 길면 사진이 양보한다.
 */
export function photoHeightFor(
  ctx: CanvasRenderingContext2D,
  headline: string,
  body: string | undefined,
  hasEyebrow: boolean,
): number {
  const need = textBlockHeight(ctx, headline, body, hasEyebrow) + TEXT_GAP_TOP + PAD;
  return Math.max(PHOTO_H_MIN, Math.min(PHOTO_H_MAX, S - need));
}

/** 우상단 둥근 페이지 배지 */
export function drawPageBadge(
  ctx: CanvasRenderingContext2D,
  index: number,
  total: number,
  onPhoto: boolean,
) {
  const r = 46;
  const cx = S - PAD - r;
  const cy = PAD + r - 8;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = onPhoto ? 'rgba(20,23,26,0.55)' : 'rgba(20,23,26,0.08)';
  ctx.fill();
  ctx.fillStyle = onPhoto ? '#ffffff' : INK_SOFT;
  ctx.font = `34px "${PHOTO_HEAD_FONT}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${index + 1}/${total}`, cx, cy + 2);
  ctx.restore();
}

/**
 * 사진 아래 본문. 헤드라인은 강조 구간을 키 컬러로 칠하고,
 * 전체가 영역을 넘으면 통째로 줄인다.
 */
export function drawPhotoText(
  ctx: CanvasRenderingContext2D,
  headline: string,
  body: string | undefined,
  accent: string,
  opts: { eyebrow?: string; topOffset: number; reserveBottom?: number },
) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 측정
  ctx.font = `${HEAD}px "${PHOTO_HEAD_FONT}"`;
  const headRuns = parseHeadline(headline.replace(/\\n/g, '\n'));
  const headLines = wrapToWidth(ctx, stripEmphasis(headline), TEXT_W);

  ctx.font = `${BODY}px "${PHOTO_BODY_FONT}"`;
  const bodyLines = body ? wrapToWidth(ctx, body, TEXT_W) : [];

  const blocks: Block[] = [
    { lines: headLines, size: HEAD, lineHeight: HEAD * 1.3, color: INK, font: PHOTO_HEAD_FONT, runs: headRuns },
  ];
  if (bodyLines.length) {
    blocks.push({ lines: bodyLines, size: BODY, lineHeight: BODY * 1.58, color: INK_SOFT, font: PHOTO_BODY_FONT });
  }

  const top = opts.topOffset;
  const eyebrowH = opts.eyebrow ? 34 * 1.4 + 22 : 0;
  const available = S - top - PAD - eyebrowH - (opts.reserveBottom ?? 0);
  const k = fitBlocks(blocks, GAP, available);

  let y = top;

  if (opts.eyebrow) {
    ctx.font = `${Math.round(34 * k)}px "${PHOTO_HEAD_FONT}"`;
    ctx.fillStyle = accent;
    ctx.fillText(opts.eyebrow, PAD, y + 34 * k);
    y += 34 * k * 1.4 + 22;
  }

  // 헤드라인 — 글자마다 강조 여부를 들고 다니며 줄바꿈한다.
  // 어절을 문자열로 비교하면 'SVG,' 처럼 구두점이 붙은 순간 빗나간다.
  const headSize = HEAD * k;
  ctx.font = `${headSize}px "${PHOTO_HEAD_FONT}"`;
  for (const lineChars of wrapChars(ctx, headRuns, TEXT_W)) {
    let x = PAD;
    for (const c of lineChars) {
      ctx.fillStyle = c.em ? accent : INK;
      ctx.fillText(c.ch, x, y + headSize);
      x += ctx.measureText(c.ch).width;
    }
    y += headSize * 1.3;
  }

  if (bodyLines.length) {
    y += GAP * k;
    const bodySize = BODY * k;
    ctx.font = `${bodySize}px "${PHOTO_BODY_FONT}"`;
    ctx.fillStyle = INK_SOFT;
    for (const line of bodyLines) {
      ctx.fillText(line, PAD, y + bodySize);
      y += bodySize * 1.58;
    }
  }
}

/* ─── 마지막 장: 팔로우 카드 ─── */

export const PROFILE = {
  handle: 'mongle_ux',
  name: '몽글 UX',
  /** public/ 에 넣은 프로필 이미지. 없으면 핸들 첫 글자로 대체한다 */
  avatar: '/profile.png',
};

const IG_BLUE = '#0095f6';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 커서 화살표 — 실제로 누르는 느낌을 준다 */
function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 30);
  ctx.lineTo(7.5, 23);
  ctx.lineTo(12.5, 34);
  ctx.lineTo(17.5, 31.5);
  ctx.lineTo(12.5, 21);
  ctx.lineTo(22, 20);
  ctx.closePath();
  ctx.fillStyle = '#15171a';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/**
 * 인스타 팔로우 카드.
 * 아바타 + 핸들 + 표시 이름 + 파란 팔로우 버튼 + 커서.
 * 캡처 이미지가 아니라 네이티브로 그려서 1080 에서도 선명하다.
 */
export function drawFollowCard(
  ctx: CanvasRenderingContext2D,
  avatar: HTMLImageElement | null,
  y: number,
): number {
  const w = S - PAD * 2;
  const h = 186;
  const x = PAD;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, 28);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(20,23,26,0.14)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 6;
  ctx.fill();
  ctx.restore();

  // 아바타
  const ar = 56;
  const acx = x + 38 + ar;
  const acy = y + h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(acx, acy, ar, 0, Math.PI * 2);
  ctx.clip();
  // 프로필 PNG 가 투명 배경이면 흰 카드에 묻히므로 밑에 면을 깔아 둔다
  ctx.fillStyle = '#f1f3f5';
  ctx.fillRect(acx - ar, acy - ar, ar * 2, ar * 2);
  if (avatar) {
    const sc = Math.max((ar * 2) / avatar.width, (ar * 2) / avatar.height);
    ctx.drawImage(avatar, acx - (avatar.width * sc) / 2, acy - (avatar.height * sc) / 2,
      avatar.width * sc, avatar.height * sc);
  } else {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `52px "${PHOTO_HEAD_FONT}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(PROFILE.handle[0].toUpperCase(), acx, acy + 2);
  }
  ctx.restore();

  // 테두리 한 겹 — 인스타 프로필 동그라미처럼 보이게 한다
  ctx.beginPath();
  ctx.arc(acx, acy, ar, 0, Math.PI * 2);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 핸들 · 이름
  const tx = acx + ar + 30;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `40px "${PHOTO_HEAD_FONT}"`;
  ctx.fillText(PROFILE.handle, tx, acy - 6);
  ctx.fillStyle = INK_FAINT;
  ctx.font = `30px "${PHOTO_BODY_FONT}"`;
  ctx.fillText(PROFILE.name, tx, acy + 38);

  // 팔로우 버튼
  const bw = 212;
  const bh = 86;
  const bx = x + w - 38 - bw;
  const by = y + (h - bh) / 2;
  roundRectPath(ctx, bx, by, bw, bh, 18);
  ctx.fillStyle = IG_BLUE;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `38px "${PHOTO_HEAD_FONT}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('팔로우', bx + bw / 2, by + bh / 2 + 2);

  drawCursor(ctx, bx + bw - 54, by + bh - 26, 1.5);
  return h;
}

/* ─── 마지막 장 전체 구성 ─── */

export const FOLLOW_HEAD = '다음 편도 궁금하시다면\n*팔로우*해주세요';
export const FOLLOW_BODY = 'AI시대 유용한 기획/디자인 팁들을 전달해드릴게요';
export const RECAP_LABEL = '이번 편 요약';
export const RECAP_MAX = 6;
export const FOLLOW_CARD_H = 186;
export const RECAP_ROW_MAX = 78;
export const RECAP_ROW_MIN = 44;
export const RECAP_GAP_TOP = 34;
export const HAIRLINE = 'rgba(20,23,26,0.08)';

/** 1080 기준 px 를 미리보기의 cqw 로. 두 쪽이 어긋나지 않게 한 곳에서 환산한다 */
export const pxToCqw = (px: number) => `${((px / S) * 100).toFixed(2)}cqw`;

/**
 * 앞 장들의 헤드라인을 한 줄짜리 목차로 만든다.
 * 마지막 장이 팔로우 요청만 덩그러니 남지 않도록 내용을 되짚어 준다.
 */
export function recapItems(headlines: string[]): string[] {
  return headlines
    .map((h) => stripEmphasis(h).replace(/\\n|\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, RECAP_MAX);
}

function ellipsise(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

/** 강조 구간을 키 컬러로 칠하며 그리고, 끝난 y 를 돌려준다 */
function drawEmphasisedLines(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[][],
  y: number,
  size: number,
  lineHeight: number,
  accent: string,
): number {
  ctx.font = `${size}px "${PHOTO_HEAD_FONT}"`;
  for (const lineChars of wrapChars(ctx, runs, TEXT_W)) {
    let x = PAD;
    for (const c of lineChars) {
      ctx.fillStyle = c.em ? accent : INK;
      ctx.fillText(c.ch, x, y + size);
      x += ctx.measureText(c.ch).width;
    }
    y += lineHeight;
  }
  return y;
}

/**
 * 마지막 장 — 목차 / 다음 편 예고 / 팔로우 카드.
 * 아래 두 블록의 높이를 먼저 재고 남는 자리를 목차가 채운다.
 * 그래야 예고가 두 줄이든 세 줄이든 가운데가 비지 않는다.
 */
export function drawFollowSlide(
  ctx: CanvasRenderingContext2D,
  opts: { recap: string[]; nextStory: string; avatar: HTMLImageElement | null; accent: string },
) {
  const { recap, nextStory, avatar, accent } = opts;
  const hasStory = nextStory.trim().length > 0;
  const headText = hasStory ? nextStory : FOLLOW_HEAD;

  const EYE = 32;
  const HEAD = 56;
  const BODY = 30;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const followTop = S - PAD - FOLLOW_CARD_H;

  // 아래 블록 높이를 먼저 잰다
  const headRuns = parseHeadline(headText.replace(/\\n/g, '\n'));
  ctx.font = `${HEAD}px "${PHOTO_HEAD_FONT}"`;
  const headLines = wrapChars(ctx, headRuns, TEXT_W).length;
  ctx.font = `${BODY}px "${PHOTO_BODY_FONT}"`;
  const bodyLines = wrapToWidth(ctx, FOLLOW_BODY, TEXT_W);

  const nextH = (hasStory ? EYE * 1.35 + 16 : 0)
    + headLines * HEAD * 1.32
    + 16 + bodyLines.length * BODY * 1.5;
  const nextTop = followTop - 48 - nextH;

  // 목차
  const labelY = PAD + 72;
  ctx.font = `30px "${PHOTO_BODY_FONT}"`;
  ctx.fillStyle = INK_FAINT;
  ctx.fillText(RECAP_LABEL, PAD, labelY);

  const recapTop = labelY + RECAP_GAP_TOP;
  const avail = nextTop - 24 - recapTop;
  const rowH = recap.length
    ? Math.max(RECAP_ROW_MIN, Math.min(RECAP_ROW_MAX, avail / recap.length))
    : 0;

  recap.forEach((text, i) => {
    const ry = recapTop + rowH * i;
    const cy = ry + rowH / 2;

    ctx.beginPath();
    ctx.arc(PAD + 19, cy, 19, 0, Math.PI * 2);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `24px "${PHOTO_HEAD_FONT}"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), PAD + 19, cy + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const tx = PAD + 58;
    const size = Math.min(38, rowH * 0.52);
    ctx.font = `${size}px "${PHOTO_HEAD_FONT}"`;
    ctx.fillStyle = INK;
    ctx.fillText(ellipsise(ctx, text, S - PAD - tx), tx, cy + size * 0.36);

    if (i < recap.length - 1) {
      ctx.strokeStyle = HAIRLINE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD, ry + rowH);
      ctx.lineTo(S - PAD, ry + rowH);
      ctx.stroke();
    }
  });

  // 다음 편 예고
  let y = nextTop;
  if (hasStory) {
    ctx.font = `${EYE}px "${PHOTO_HEAD_FONT}"`;
    ctx.fillStyle = accent;
    ctx.fillText('NEXT STORY', PAD, y + EYE);
    y += EYE * 1.35 + 16;
  }
  y = drawEmphasisedLines(ctx, headRuns, y, HEAD, HEAD * 1.32, accent);
  y += 16;
  ctx.font = `${BODY}px "${PHOTO_BODY_FONT}"`;
  ctx.fillStyle = INK_SOFT;
  for (const line of bodyLines) {
    ctx.fillText(line, PAD, y + BODY);
    y += BODY * 1.5;
  }

  drawFollowCard(ctx, avatar, followTop);
}
