import localFont from 'next/font/local';

/**
 * 인스타그램 카드 전용 서체 (배달의민족, SIL OFL 1.1).
 *
 * preload: false 인 이유 — 카드 렌더에만 쓰는 서체라 텍스트 플랫폼만 쓰는
 * 사용자가 624KB를 미리 받을 이유가 없다. 실제로 카드를 그릴 때 받아간다.
 *
 * Canvas 로 PNG 를 그릴 때는 CANVAS_FONT_* 의 이름을 ctx.font 에 넣어야 한다.
 * next/font 가 붙이는 해시 이름이 아니라 아래 declarations 의 이름이 쓰이도록
 * declarations 로 고정 이름을 같이 등록해 둔다.
 */

export const euljiro = localFont({
  src: '../public/fonts/BMEuljiro.woff2',
  display: 'swap',
  preload: false,
  variable: '--font-ig-head',
  declarations: [{ prop: 'font-family', value: 'BMEuljiroCanvas' }],
});

export const hanna = localFont({
  src: '../public/fonts/BMHannaPro.woff2',
  display: 'swap',
  preload: false,
  variable: '--font-ig-body',
  declarations: [{ prop: 'font-family', value: 'BMHannaProCanvas' }],
});

/**
 * 사진 카드 전용 (Pretendard, SIL OFL).
 * 손글씨 카드와 일부러 다른 결로 가기 위해 굵은 모던 산세리프를 쓴다.
 */
export const pretendardBold = localFont({
  src: '../public/fonts/Pretendard-Bold.woff2',
  display: 'swap',
  preload: false,
  variable: '--font-photo-head',
  declarations: [{ prop: 'font-family', value: 'PretendardBoldCanvas' }],
});

export const pretendardMedium = localFont({
  src: '../public/fonts/Pretendard-Medium.woff2',
  display: 'swap',
  preload: false,
  variable: '--font-photo-body',
  declarations: [{ prop: 'font-family', value: 'PretendardMediumCanvas' }],
});

/** Canvas 의 ctx.font 에 쓰는 이름 */
export const CANVAS_HEAD = 'BMEuljiroCanvas';
export const CANVAS_BODY = 'BMHannaProCanvas';
export const PHOTO_HEAD_FONT = 'PretendardBoldCanvas';
export const PHOTO_BODY_FONT = 'PretendardMediumCanvas';

/**
 * Canvas 는 웹폰트가 준비되기 전에 그리면 시스템 폰트로 대체된다.
 * 그리기 직전에 반드시 await 해야 다운로드 PNG 가 화면과 같아진다.
 */
/** 사진 카드용. 그리기 전에 반드시 await 한다 */
export async function waitForPhotoFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`400 100px "${PHOTO_HEAD_FONT}"`),
      document.fonts.load(`400 100px "${PHOTO_BODY_FONT}"`),
    ]);
    await document.fonts.ready;
  } catch {
    /* 못 받아도 그리기는 진행한다 */
  }
}

export async function waitForCardFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load(`700 100px "${CANVAS_HEAD}"`),
      document.fonts.load(`400 100px "${CANVAS_BODY}"`),
    ]);
    await document.fonts.ready;
  } catch {
    /* 폰트를 못 받아도 그리기는 진행한다 — 시스템 폰트로라도 나오는 편이 낫다 */
  }
}
