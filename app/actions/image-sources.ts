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
 * 어떤 모델을 쓸 수 있는지는 키마다 다르다.
 *
 * 처음에는 gpt-image-1 하나에 매달렸고, 다음에는 dall-e-3 를 뒤에 붙였다.
 * 둘 다 "모델이 없다"고 돌아오는 키가 있다 — OpenAI 프로젝트 키는 모델
 * 권한을 따로 주게 되어 있고, 크레딧을 넣기 전에는 이미지 모델이 아예
 * 목록에 없다. 그래서 이제 /v1/models 로 먼저 물어보고 가진 것 중 제일
 * 나은 걸 고른다. 없는 모델을 부르고 404 를 받는 일이 없다.
 *
 * 사진 칸이 가로로 기니 가로 크기를 고른다.
 */
interface ImageSpec {
  model: string;
  size: string;
  extra?: Record<string, string>;
}

const IMAGE_PREFERENCE: ImageSpec[] = [
  { model: 'gpt-image-1.5', size: '1536x1024', extra: { quality: 'medium' } },
  { model: 'gpt-image-1', size: '1536x1024', extra: { quality: 'medium' } },
  { model: 'gpt-image-1-mini', size: '1536x1024', extra: { quality: 'medium' } },
  { model: 'dall-e-3', size: '1792x1024' },
  { model: 'dall-e-2', size: '1024x1024' },
];

function friendlyImageError(raw: string): string {
  if (/must be verified|organization must be verified/i.test(raw)) {
    return 'OpenAI 조직 인증이 필요합니다. platform.openai.com → Settings → Organization 에서 인증하세요';
  }
  if (/does not exist|do not have access/i.test(raw)) {
    return '이 키로는 쓸 수 없는 모델입니다';
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
    return '안전 정책에 걸렸습니다. 다른 카드로 시도해보세요';
  }
  return raw;
}

const NO_IMAGE_MODEL =
  '이 키로 쓸 수 있는 이미지 모델이 없습니다. platform.openai.com → Settings → '
  + 'Billing 에 크레딧이 있는지, Project → Limits 에서 이미지 모델이 허용돼 있는지 확인하세요';

/** 이 키가 실제로 쓸 수 있는 이미지 모델. 못 물어보면 null */
async function availableImageSpecs(apiKey: string): Promise<ImageSpec[] | null> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ids = new Set(
      (data.data as Array<{ id?: string }> | undefined)?.map((m) => m.id).filter(Boolean) as string[],
    );
    return IMAGE_PREFERENCE.filter((spec) => ids.has(spec.model));
  } catch {
    return null;
  }
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

async function callImageApi(
  spec: ImageSpec,
  prompt: string,
  apiKey: string,
): Promise<{ url: string } | { error: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: spec.model, prompt, n: 1, size: spec.size, ...(spec.extra ?? {}) }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const parsed = (() => { try { return JSON.parse(body); } catch { return null; } })();
      return { error: parsed?.error?.message || `HTTP ${res.status}` };
    }

    const data = await res.json();
    const first = data.data?.[0] as { b64_json?: string; url?: string } | undefined;
    if (first?.b64_json) return { url: `data:image/png;base64,${first.b64_json}` };
    if (first?.url) {
      const inlined = await toDataUri(first.url);
      return inlined ? { url: inlined } : { error: '이미지를 내려받지 못했습니다' };
    }
    return { error: '응답에 이미지가 없습니다' };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function generateImageWithGPT(
  prompt: string,
  apiKey: string,
  specs?: ImageSpec[],
): Promise<{ url: string | null; error?: string }> {
  // 목록을 못 받아오면 예전처럼 차례로 찔러본다
  const candidates = specs ?? (await availableImageSpecs(apiKey)) ?? IMAGE_PREFERENCE;
  if (candidates.length === 0) return { url: null, error: NO_IMAGE_MODEL };

  // 어느 모델이 왜 막혔는지 한 번에 보여준다. 마지막 오류만 띄우면
  // 한 번에 하나씩만 알게 되어 진단이 느리다
  const failures: string[] = [];
  for (const spec of candidates) {
    const out = await callImageApi(spec, prompt, apiKey);
    if ('url' in out) return { url: out.url };
    console.error(`[image] ${spec.model}: ${out.error}`);
    failures.push(`${spec.model} — ${friendlyImageError(out.error)}`);
  }
  return { url: null, error: failures.join(' / ') };
}

/** 키가 이미지 모델을 쓸 수 있는지, 어떤 걸 쓰게 되는지 알려준다 */
export async function checkImageModels(
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  const specs = await availableImageSpecs(apiKey);
  if (specs === null) {
    return { ok: false, message: '모델 목록을 불러오지 못했습니다. 키를 다시 확인해주세요' };
  }
  if (specs.length === 0) return { ok: false, message: NO_IMAGE_MODEL };
  return { ok: true, message: `사용 가능: ${specs.map((s) => s.model).join(', ')}` };
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

  // 장마다 모델 목록을 다시 묻지 않는다
  const specs = openaiKey ? (await availableImageSpecs(openaiKey)) ?? IMAGE_PREFERENCE : [];

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
      const result = await generateImageWithGPT(photoPrompt(slide.headline), openaiKey, specs);
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
    // data URI 는 Unsplash 결과와 겹칠 수 없으니 걸러낼 것도 없다
    const used = new Set(usedImageUrls?.filter((u) => u?.startsWith('http')) ?? []);
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
