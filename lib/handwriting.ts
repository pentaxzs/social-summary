/**
 * 손글씨 느낌을 내는 공용 규칙.
 *
 * 미리보기(React)와 다운로드(Canvas)가 **같은 결과**를 내야 하므로
 * 흔들림 계산과 강조 파싱을 전부 여기에 둔다. 한쪽에만 고치면
 * 화면과 받은 PNG 가 달라진다.
 */

/** 문자열에서 뽑는 고정 시드. 같은 문구는 언제 그려도 같은 모양으로 흔들린다 */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
}

export interface Jitter {
  /** 회전 각도 (deg) */
  rot: number;
  /** 세로 이동, 글자 크기 대비 비율 */
  dy: number;
  /** 크기 배율 */
  scale: number;
}

/** 헤드라인은 크게, 본문은 약하게 흔든다. 작은 글씨까지 흔들면 조잡해진다 */
export type JitterStrength = 'strong' | 'soft' | 'none';

const PRESET: Record<Exclude<JitterStrength, 'none'>, { rot: number; dy: number; sc: number }> = {
  strong: { rot: 4.0, dy: 0.04, sc: 0.055 },
  soft: { rot: 1.8, dy: 0.016, sc: 0.03 },
};

/**
 * 한 줄에 들어갈 글자 수만큼 흔들림 값을 만든다.
 * seedText 가 같으면 결과도 같다.
 */
export function jittersFor(seedText: string, count: number, strength: JitterStrength): Jitter[] {
  if (strength === 'none') {
    return Array.from({ length: count }, () => ({ rot: 0, dy: 0, scale: 1 }));
  }
  const p = PRESET[strength];
  const r = makeRng(hashString(seedText));
  return Array.from({ length: count }, () => ({
    rot: (r() * 2 - 1) * p.rot,
    dy: (r() * 2 - 1) * p.dy,
    scale: 1 - p.sc / 2 + r() * p.sc,
  }));
}

export interface TextRun {
  text: string;
  /** *별표*로 감싼 강조 구간 */
  emphasis: boolean;
}

/**
 * `왜 *지금*\n중요한가` → 줄 단위, 그 안에서 강조/비강조 구간으로 쪼갠다.
 * 별표가 없으면 전체가 비강조 한 덩어리가 된다.
 */
export function parseHeadline(raw: string): TextRun[][] {
  return raw.split('\n').map((line) => {
    const runs: TextRun[] = [];
    // *...* 를 찾되, 빈 강조(**)와 닫히지 않은 별표는 그냥 글자로 둔다
    const re = /\*([^*\n]+)\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) runs.push({ text: line.slice(last, m.index), emphasis: false });
      runs.push({ text: m[1], emphasis: true });
      last = m.index + m[0].length;
    }
    if (last < line.length) runs.push({ text: line.slice(last), emphasis: false });
    return runs.length ? runs : [{ text: '', emphasis: false }];
  });
}

/** 강조 구간은 이 배율로 커진다 */
export const EMPHASIS_SCALE = 1.45;

/**
 * 한 줄이 차지하는 '글자 폭'의 합. 1 = 한글 한 글자 폭.
 * 실측이 아니라 글자 종류로 어림한다 — 그래야 React 와 Canvas 가
 * 측정 없이도 **같은 값**을 얻는다.
 */
export function lineWidthUnits(runs: TextRun[]): number {
  let w = 0;
  for (const run of runs) {
    const mul = run.emphasis ? EMPHASIS_SCALE : 1;
    for (const ch of run.text) {
      let base: number;
      if (ch === ' ') base = 0.38;
      else if (/[iIl.,!|'"`:;]/.test(ch)) base = 0.3;
      else if (/[A-Za-z0-9()[\]{}?/\\-]/.test(ch)) base = 0.58;
      else base = 1; // 한글·한자·전각
      w += base * mul;
    }
  }
  return w;
}

/**
 * 가장 긴 줄이 maxUnits 를 넘으면 그만큼 줄인다.
 * 헤드라인을 크게 잡아도 긴 문장에서 넘치지 않게 해준다.
 */
export function fitScale(lines: TextRun[][], maxUnits: number): number {
  const widest = Math.max(...lines.map(lineWidthUnits), 0.001);
  return widest > maxUnits ? maxUnits / widest : 1;
}

/** 별표를 걷어낸 순수 텍스트 — 글자 수를 셀 때 쓴다 */
export function stripEmphasis(raw: string): string {
  return raw.replace(/\*([^*\n]+)\*/g, '$1');
}
