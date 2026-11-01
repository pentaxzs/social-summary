/**
 * 인스타그램 카드의 키 컬러.
 *
 * 종이(크림)와 잉크(브라운)는 고정이고, 강조색만 고를 수 있다.
 * 알약 배지는 이 색을 배경으로 쓰고 그 위에 종이색 글자를 얹으므로,
 * 크림 위에서 충분히 어두운 색만 넣는다.
 */

export interface CardAccent {
  key: string;
  label: string;
  value: string;
}

export const CARD_ACCENTS: CardAccent[] = [
  { key: 'green', label: '그린', value: '#2e9e63' },
  { key: 'blue', label: '블루', value: '#24679f' },
  { key: 'coral', label: '코랄', value: '#cf5139' },
  { key: 'mustard', label: '머스터드', value: '#bd8014' },
  { key: 'plum', label: '플럼', value: '#8a3f6d' },
];

/** 처음 만드는 카드의 키 컬러. 스와치도 이 순서로 보인다 */
export const DEFAULT_ACCENT = CARD_ACCENTS[0].value;

/** 고른 색은 브라우저에만 남긴다 — 다음에 카드를 만들 때도 같은 색으로 */
export const LS_CARD_ACCENT = 'ss_card_accent';

export function readStoredAccent(): string {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  try {
    const v = localStorage.getItem(LS_CARD_ACCENT);
    return CARD_ACCENTS.some((a) => a.value === v) ? v! : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT; // 프라이빗 모드 등에서 접근이 막힐 수 있다
  }
}

export function storeAccent(value: string): void {
  try {
    localStorage.setItem(LS_CARD_ACCENT, value);
  } catch {
    /* 저장 못 해도 이번 세션에는 적용된다 */
  }
}
