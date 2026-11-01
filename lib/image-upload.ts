/**
 * 사진첩에서 고른 이미지를 카드에 쓸 수 있게 다듬는다.
 *
 * 원본 크기를 신경 쓰지 않아도 되도록 여기서 전부 정리한다.
 * - 아이폰 사진은 4000px 이 넘기도 한다. 카드가 1080 이라 그대로 들고 있을 이유가 없다
 * - EXIF 회전 정보를 반영한다. 세로로 찍은 사진이 눕는 걸 막는다
 * - data URI 로 바꿔 둔다. Canvas 가 CORS 없이 읽어야 PNG 에도 똑같이 들어간다
 */

/** 긴 변 기준 최대 크기. 카드 1080 의 1.5배면 충분하다 */
const MAX_EDGE = 1620;
const QUALITY = 0.86;

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* 아래 <img> 경로로 내려간다 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
  } finally {
    // onload 이후에 풀어도 이미 디코드가 끝나 있다
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export async function optimiseUploadedImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 올릴 수 있습니다');
  }

  let src: CanvasImageSource & { width: number; height: number };
  try {
    src = await decode(file);
  } catch {
    // 아이폰 HEIC 를 데스크톱 브라우저로 올리면 여기로 온다
    throw new Error('이 형식은 브라우저가 열지 못합니다. JPG 나 PNG 로 올려주세요');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 처리하지 못했습니다');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  if ('close' in src && typeof src.close === 'function') src.close();

  // 사진에 투명도는 필요 없고, JPEG 가 PNG 보다 한참 가볍다
  return canvas.toDataURL('image/jpeg', QUALITY);
}
