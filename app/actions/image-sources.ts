'use server';

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

/** Unsplash 검색 한 쪽에 담기는 최대 개수 */
const PER_PAGE = 30;

/**
 * Unsplash 에서 아직 안 쓴 사진 하나를 고른다.
 *
 * 처음에는 per_page 10 에 squarish 로 묶어놓고 늘 첫 번째 결과를 집었다.
 * 비슷한 검색어가 들어오면 같은 사진이 계속 나올 수밖에 없는 구조였다.
 * 이제 사진 칸이 가로로 길어졌으니 landscape 로 넓게 찾고, 서른 장 중에서
 * 안 쓴 것을 무작위로 고른다.
 */
export async function searchUnsplash(
  query: string,
  accessKey: string,
  usedUrls: Set<string> = new Set(),
  page = 1,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      query,
      per_page: String(PER_PAGE),
      page: String(page),
      orientation: 'landscape',
      content_filter: 'high',
    });
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[Unsplash] HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      return null;
    }
    const data = await res.json();
    const results = data.results as Array<{ urls?: { regular?: string } }> | undefined;
    if (!results || results.length === 0) return null;

    const fresh = results
      .map((p) => p.urls?.regular)
      .filter((u): u is string => !!u && !usedUrls.has(u));

    // 이 쪽을 다 써버렸으면 다음 쪽을 본다 (총 결과가 남아 있을 때만)
    if (fresh.length === 0) {
      const total = (data.total_pages as number | undefined) ?? 1;
      if (page < Math.min(total, 4)) {
        return searchUnsplash(query, accessKey, usedUrls, page + 1);
      }
      return null;
    }
    return fresh[Math.floor(Math.random() * fresh.length)];
  } catch {
    return null;
  }
}

/* ─── AI 이미지 생성 ─── */

/**
 * 모델을 차례로 시도한다.
 * gpt-image-1 은 OpenAI 조직 인증을 마친 계정만 쓸 수 있어 인증 전이면 403 이
 * 떨어진다. 그 경우 누구나 쓸 수 있는 dall-e-3 로 넘어간다.
 *
 * SDK 의 이미지 모델을 쓰지 않고 직접 부른다. SDK 는 dall-e 계열에
 * response_format: "b64_json" 을 붙여 보내는데 지금 API 는 그 파라미터를
 * 모른다고 거부한다 ("Unknown parameter: 'response_format'").
 * 어차피 보낼 것이 몇 개 안 되니 우리가 쥐고 있는 편이 낫다.
 *
 * 사진 칸이 가로로 기니 가로 이미지를 받아야 덜 잘린다.
 */
const IMAGE_MODELS: Array<{ model: string; size: string; extra?: Record<string, string> }> = [
  { model: 'gpt-image-1', size: '1536x1024', extra: { quality: 'medium' } },
  { model: 'dall-e-3', size: '1792x1024' },
];

function friendlyImageError(raw: string): string {
  if (/must be verified|organization must be verified/i.test(raw)) {
    return 'OpenAI 조직 인증이 필요한 모델입니다. platform.openai.com 에서 인증하면 더 좋은 모델을 씁니다';
  }
  if (/billing|quota|insufficient/i.test(raw)) {
    return 'OpenAI 크레딧이 부족합니다';
  }
  if (/invalid[_ ]api[_ ]key|incorrect api key|401/i.test(raw)) {
    return 'OpenAI 키가 올바르지 않습니다';
  }
  if (/abort|timed? ?out/i.test(raw)) {
    return '이미지 생성이 너무 오래 걸려 중단했습니다. 다시 눌러보세요';
  }
  if (/safety|content[_ ]policy|moderation/i.test(raw)) {
    return '안전 정책에 걸려 이미지를 만들지 못했습니다. 다른 카드로 시도해보세요';
  }
  return raw;
}

/** URL 로 돌아온 이미지를 data URI 로 바꾼다. Canvas 가 CORS 없이 읽으려면 필요하다 */
async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function generateImageWithGPT(
  prompt: string,
  apiKey: string,
): Promise<{ url: string | null; error?: string }> {
  let lastError = '이미지를 만들지 못했습니다';

  for (const m of IMAGE_MODELS) {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: m.model,
          prompt,
          n: 1,
          size: m.size,
          ...(m.extra ?? {}),
        }),
        signal: AbortSignal.timeout(120_000),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        const parsed = (() => { try { return JSON.parse(body); } catch { return null; } })();
        const raw = parsed?.error?.message || `HTTP ${res.status}`;
        console.error(`[image] ${m.model} 실패: ${raw}`);
        lastError = `${friendlyImageError(raw)} (${m.model})`;
        continue;
      }

      const data = await res.json();
      const first = data.data?.[0] as { b64_json?: string; url?: string } | undefined;
      if (first?.b64_json) return { url: `data:image/png;base64,${first.b64_json}` };
      if (first?.url) {
        const dataUri = await toDataUri(first.url);
        if (dataUri) return { url: dataUri };
        lastError = `이미지를 내려받지 못했습니다 (${m.model})`;
        continue;
      }
      lastError = `응답에 이미지가 없습니다 (${m.model})`;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      console.error(`[image] ${m.model} 실패: ${raw}`);
      lastError = `${friendlyImageError(raw)} (${m.model})`;
    }
  }
  return { url: null, error: lastError };
}

/* ─── 검색어 ─── */

const FALLBACK_QUERIES = [
  'minimal desk workspace',
  'city night long exposure',
  'abstract light texture',
  'hands typing laptop',
  'open notebook coffee',
  'modern architecture lines',
  'studio still life objects',
  'team meeting whiteboard',
];

/**
 * 모든 슬라이드의 검색어를 한 번에 만든다.
 *
 * 장마다 따로 물어보면 모델이 매번 "modern tech workspace" 같은 안전한
 * 표현을 돌려줘서 Unsplash 가 같은 사진 몇 장을 계속 내놨다.
 * 한 번에 물어보면서 서로 겹치지 말라고 못 박는다.
 */
async function generateSearchQueries(
  slides: Array<{ headline: string; keyword?: string }>,
  apiKey: string,
): Promise<string[]> {
  const fallback = slides.map((s, i) =>
    FALLBACK_QUERIES[i % FALLBACK_QUERIES.length]);

  try {
    const openai = createOpenAI({ apiKey });
    const list = slides
      .map((s, i) => `${i + 1}. ${s.keyword ? `[${s.keyword}] ` : ''}${s.headline.replace(/\\n/g, ' ')}`)
      .join('\n');

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt: `Write one Unsplash search query per slide for a Korean tech/design newsletter carousel.

Slides:
${list}

Rules:
- One query per line, in the same order, numbered "1." "2." and so on. Nothing else.
- 2 to 4 English words. A concrete photographable scene, not an abstract idea.
- Every query must be VISUALLY DIFFERENT from the others. No two slides may share
  a subject. Vary the setting, the subject and the framing across the list.
- Ban these overused phrases: "modern tech workspace", "digital interface",
  "abstract technology", "futuristic AI", "data visualization", "business meeting".
- Lead with a physical noun: an object, a place, a person doing something, a texture.
  Good: "ceramic cups shelf", "rainy window neon", "sketchbook pencil close up",
  "empty subway platform", "stacked paper documents", "potter shaping clay".
- Avoid words whose everyday meaning differs from the slide's point.`,
    });

    const lines = result.text
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);

    return slides.map((_, i) => lines[i] || fallback[i]);
  } catch {
    return fallback;
  }
}

/* ─── 슬라이드에 사진 붙이기 ─── */

/**
 * 슬라이드마다 쓸 이미지를 고른다.
 *
 * 원문 기사 이미지는 쓰지 않는다. Canvas 는 crossOrigin='anonymous' 로
 * 불러오는데 임의의 기사 사이트는 CORS 헤더를 주지 않아 로드가 실패한다.
 * 그러면 화면(<img>)에는 사진이 보이는데 내려받은 PNG 에는 빠지는,
 * 눈에 띄지 않는 불일치가 생긴다. Unsplash 는 CORS 를 허용하고
 * GPT 이미지는 data URI 라 둘 다 안전하다.
 */
export async function assignImagesToSlides(
  slides: Array<{ headline: string; keyword?: string; layout?: string }>,
  unsplashKey?: string,
  openaiKey?: string,
): Promise<string[]> {
  const imageUrls: string[] = [];
  const usedUrls = new Set<string>();

  const queries = openaiKey
    ? await generateSearchQueries(slides, openaiKey)
    : slides.map((s) => s.headline.replace(/\\n/g, ' '));

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];

    // 마무리 슬라이드는 사진 없이 간다
    if (slide.layout === 'outro') {
      imageUrls.push('');
      continue;
    }

    if (unsplashKey) {
      console.log(`[Unsplash] ${i + 1}번 → "${queries[i]}"`);
      const url = await searchUnsplash(queries[i], unsplashKey, usedUrls);
      if (url) {
        imageUrls.push(url);
        usedUrls.add(url);
        continue;
      }
    }

    if (openaiKey) {
      const result = await generateImageWithGPT(photoPrompt(slide.headline), openaiKey);
      if (result.url) {
        imageUrls.push(result.url);
        continue;
      }
    }

    imageUrls.push('');
  }

  return imageUrls;
}

function photoPrompt(headline: string): string {
  return `A single editorial photograph for a magazine spread about: "${headline.replace(/\\n/g, ' ')}". Documentary style, natural light, shallow depth of field, muted colours. One clear subject, generous empty space. Absolutely no text, letters, numbers, logos or UI in the frame.`;
}

/** 슬라이드 한 장의 사진만 다시 고른다 */
export async function regenerateSlideImage(
  source: 'unsplash' | 'gpt',
  headline: string,
  keyword: string | undefined,
  unsplashKey?: string,
  openaiKey?: string,
  usedImageUrls?: string[],
): Promise<{ url: string | null; error?: string }> {
  if (source === 'unsplash') {
    if (!unsplashKey) return { url: null, error: 'Unsplash 키가 없습니다' };
    const [query] = openaiKey
      ? await generateSearchQueries([{ headline, keyword }], openaiKey)
      : [headline.replace(/\\n/g, ' ')];

    // 이미 다른 장에 붙은 사진은 모두 제외한다. 직전 사진만 빼면
    // 두 장 사이를 오가게 된다
    const used = new Set(usedImageUrls?.filter(Boolean) ?? []);
    console.log(`[Unsplash 재검색] "${query}", 제외 ${used.size}장`);
    const url = await searchUnsplash(query, unsplashKey, used);
    return url
      ? { url }
      : { url: null, error: 'Unsplash에서 다른 사진을 찾지 못했습니다' };
  }

  if (source === 'gpt') {
    if (!openaiKey) return { url: null, error: 'OpenAI 키가 없습니다' };
    const result = await generateImageWithGPT(photoPrompt(headline), openaiKey);
    return result.url
      ? { url: result.url }
      : { url: null, error: result.error || '이미지 생성에 실패했습니다' };
  }

  return { url: null, error: '알 수 없는 소스입니다' };
}
