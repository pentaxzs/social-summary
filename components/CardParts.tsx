/**
 * 카드 미리보기 공용 조각.
 *
 * Canvas 쪽(lib/card-canvas.ts)과 같은 비율·같은 흔들림을 써야
 * 화면과 내려받은 PNG 가 일치한다. 한 곳에서만 고친다.
 */
import React from 'react';
import { parseHeadline, jittersFor, fitScale, EMPHASIS_SCALE, TextRun, JitterStrength } from '@/lib/handwriting';
import { CANVAS_HEAD, CANVAS_BODY } from '@/lib/fonts';
import { PAPER, INK, INK_FAINT, S, TEXT_UNITS, pxToCqw } from '@/lib/card-canvas';

/** 글자를 하나씩 span 으로 쪼개 같은 흔들림을 입힌다 */
export function Jittered({
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
export function HeadlinePreview({ raw, basePx, accent }: { raw: string; basePx: number; accent: string }) {
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

export function BodyPreview({ raw, basePx, color }: { raw: string; basePx: number; color: string }) {
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

export const Slash = ({ flip, accent }: { flip?: boolean; accent: string }) => (
  <svg width="4.2cqw" height="3.4cqw" viewBox="0 0 20 16" style={{ transform: flip ? 'scaleX(-1)' : undefined, flex: 'none' }}>
    <g stroke={accent} strokeWidth="2.4" strokeLinecap="round">
      <path d="M3 3 L9 8" /><path d="M3 13 L9 8" /><path d="M10 3 L16 8" /><path d="M10 13 L16 8" />
    </g>
  </svg>
);

export const InstaMark = ({ accent }: { accent: string }) => (
  <svg width="6cqw" height="6cqw" viewBox="0 0 24 24" aria-hidden="true">
    <g fill="none" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
      <rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.5" />
      <circle cx="12" cy="12" r="4.15" />
    </g>
    <circle cx="17.05" cy="6.95" r="1.02" fill={accent} />
  </svg>
);

export const Pill = ({ text, accent }: { text: string; accent: string }) => (
  <span style={{
    display: 'inline-block', background: accent, color: PAPER, borderRadius: 999,
    fontFamily: `"${CANVAS_BODY}", sans-serif`, fontSize: '4.6cqw',
    padding: '1.3cqw 4.8cqw', marginBottom: '3.4cqw',
  }}>{text}</span>
);

export function CardFrame({ children, index, total, showNumber = true }: {
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

