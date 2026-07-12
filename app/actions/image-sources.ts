'use server';

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export async function searchUnsplash(
  query: string,
  accessKey: string,
  usedUrls: Set<string> = new Set()
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      query,
      per_page: '10',
      orientation: 'squarish',
    });
    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params}`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      console.error(`[Unsplash] HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      return null;
    }
    const data = await res.json();
    const results = data.results as Array<{ urls?: { regular?: string } }> | undefined;
    if (!results || results.length === 0) return null;
    // Pick the first result not already used
    for (const photo of results) {
      const url = photo.urls?.regular;
      if (url && !usedUrls.has(url)) return url;
    }
    return null;
  } catch {
    return null;
  }
}

export async function generateImageWithGPT(
  prompt: string,
  apiKey: string
): Promise<{ url: string | null; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'png',
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[GPT Image] HTTP ${res.status}: ${errBody}`);
      const parsed = (() => { try { return JSON.parse(errBody); } catch { return null; } })();
      const msg = parsed?.error?.message || `HTTP ${res.status}`;
      return { url: null, error: msg };
    }
    const data = await res.json();
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return { url: `data:image/png;base64,${b64}` };
    const directUrl = data.data?.[0]?.url as string | undefined;
    if (directUrl) return { url: directUrl };
    return { url: null, error: '응답에 이미지 데이터가 없습니다' };
  } catch (err) {
    console.error('[GPT Image] Error:', err);
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    return { url: null, error: msg };
  }
}

/**
 * Use AI to generate English search keywords from Korean slide content.
 * Returns 2-3 English keywords suitable for Unsplash search.
 */
async function generateSearchKeywords(
  headline: string,
  keyword: string | undefined,
  apiKey: string
): Promise<string> {
  try {
    const openai = createOpenAI({ apiKey });
    const model = openai('gpt-4o-mini');
    const result = await generateText({
      model,
      prompt: `You are generating Unsplash search keywords for an IT/tech/design newsletter's Instagram carousel slide.

The content is about tech industry topics (AI, product design, UX, startups, development, etc.). Generate 2-3 English keywords that will find a VISUALLY relevant stock photo — not a literal translation.

IMPORTANT:
- Think about what IMAGE would visually represent the concept, not the literal words
- Avoid words that have common non-tech meanings (e.g., "grammar" → language textbook photos, "letter" → mail photos)
- Prefer abstract/atmospheric tech visuals: "dark tech abstract", "digital interface", "code screen", "modern workspace"

Headline: ${headline.replace(/\\n/g, ' ')}
${keyword ? `Topic: ${keyword}` : ''}

Return ONLY the keywords, nothing else.

Example outputs:
- "futuristic AI interface dark"
- "modern tech workspace minimal"
- "digital data visualization abstract"`,
    });
    return result.text.trim() || headline.replace(/\\n/g, ' ');
  } catch {
    return headline.replace(/\\n/g, ' ');
  }
}

export async function assignImagesToSlides(
  slides: Array<{ headline: string; keyword?: string; layout?: string }>,
  articleImages: string[],
  unsplashKey?: string,
  openaiKey?: string
): Promise<string[]> {
  const imageUrls: string[] = [];
  const usedUrls = new Set<string>();
  // Skip first article image (usually author profile/intro)
  const usableArticleImages = articleImages.slice(1);
  let articleIdx = 0;

  for (const slide of slides) {
    // Skip outro slides
    if (slide.layout === 'outro') {
      imageUrls.push('');
      continue;
    }

    // 1. Try article images (non-cover, first image already skipped)
    if (slide.layout !== 'cover' && articleIdx < usableArticleImages.length) {
      const url = usableArticleImages[articleIdx];
      articleIdx++;
      imageUrls.push(url);
      usedUrls.add(url);
      continue;
    }

    // 2. Try Unsplash with English keywords
    if (unsplashKey) {
      let searchQuery = slide.headline.replace(/\\n/g, ' ');
      if (openaiKey) {
        searchQuery = await generateSearchKeywords(slide.headline, slide.keyword, openaiKey);
      }

      console.log(`[Unsplash] Slide "${slide.headline.replace(/\\n/g, ' ')}" → query: "${searchQuery}"`);
      const unsplashUrl = await searchUnsplash(searchQuery, unsplashKey, usedUrls);
      if (unsplashUrl) {
        imageUrls.push(unsplashUrl);
        usedUrls.add(unsplashUrl);
        continue;
      }
    }

    // 3. Try GPT Image generation (non-cover fallback)
    if (openaiKey) {
      const imagePrompt = `A professional, cinematic photograph for an Instagram carousel slide about: "${slide.headline.replace(/\\n/g, ' ')}". Style: editorial, high quality, moody lighting, suitable as a dark background with white text overlay. No text in the image. Square format 1:1.`;
      const result = await generateImageWithGPT(imagePrompt, openaiKey);
      if (result.url) {
        imageUrls.push(result.url);
        usedUrls.add(result.url);
        continue;
      }
    }

    // Fallback: empty (component will use solid color fallback)
    imageUrls.push('');
  }

  return imageUrls;
}

/**
 * Regenerate a single slide's background image.
 */
export async function regenerateSlideImage(
  source: 'unsplash' | 'gpt',
  headline: string,
  keyword: string | undefined,
  unsplashKey?: string,
  openaiKey?: string,
  currentImageUrl?: string,
): Promise<{ url: string | null; error?: string }> {
  if (source === 'unsplash') {
    if (!unsplashKey) return { url: null, error: 'Unsplash 키가 없습니다' };
    let searchQuery = headline.replace(/\\n/g, ' ');
    if (openaiKey) {
      searchQuery = await generateSearchKeywords(headline, keyword, openaiKey);
    }
    console.log(`[Unsplash Regenerate] query: "${searchQuery}", excluding: ${currentImageUrl ? 'YES' : 'NO'}`);
    const usedUrls = new Set<string>();
    if (currentImageUrl) usedUrls.add(currentImageUrl);
    const url = await searchUnsplash(searchQuery, unsplashKey, usedUrls);
    return url ? { url } : { url: null, error: `Unsplash에서 다른 이미지를 찾지 못했습니다` };
  }

  if (source === 'gpt') {
    if (!openaiKey) return { url: null, error: 'OpenAI 키가 없습니다' };
    const imagePrompt = `Vintage newspaper editorial illustration about: "${headline.replace(/\\n/g, ' ')}". Style: retro newsprint, halftone dots, rough black ink on aged cream paper, bold woodcut-style imagery, gritty texture, monochrome with slight sepia tone. No text, no letters, no words in the image. Square format 1:1.`;
    const result = await generateImageWithGPT(imagePrompt, openaiKey);
    return result.url
      ? { url: result.url }
      : { url: null, error: result.error || 'GPT 이미지 생성에 실패했습니다' };
  }

  return { url: null, error: '알 수 없는 소스입니다' };
}
