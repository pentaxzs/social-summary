'use server';

export async function searchUnsplash(
  query: string,
  accessKey: string
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      query,
      per_page: '1',
      orientation: 'squarish',
    });
    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params}`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data.results?.[0];
    if (!photo) return null;
    // Use regular size (1080w) for Instagram
    return (photo.urls?.regular as string) || null;
  } catch {
    return null;
  }
}

export async function generateImageWithGPT(
  prompt: string,
  apiKey: string
): Promise<string | null> {
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
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // gpt-image-1 returns base64
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return `data:image/png;base64,${b64}`;
    // fallback to url if available
    return (data.data?.[0]?.url as string) || null;
  } catch {
    return null;
  }
}

export async function assignImagesToSlides(
  slides: Array<{ headline: string; keyword?: string; layout?: string }>,
  articleImages: string[],
  unsplashKey?: string,
  openaiKey?: string
): Promise<string[]> {
  const imageUrls: string[] = [];
  let articleIdx = 0;

  for (const slide of slides) {
    // Skip outro slides
    if (slide.layout === 'outro') {
      imageUrls.push('');
      continue;
    }

    // 1. Try article images first
    if (articleIdx < articleImages.length) {
      imageUrls.push(articleImages[articleIdx]);
      articleIdx++;
      continue;
    }

    // 2. Try Unsplash
    const searchQuery = slide.keyword
      ? `${slide.keyword} ${slide.headline.replace(/\\n/g, ' ')}`
      : slide.headline.replace(/\\n/g, ' ');

    if (unsplashKey) {
      const unsplashUrl = await searchUnsplash(searchQuery, unsplashKey);
      if (unsplashUrl) {
        imageUrls.push(unsplashUrl);
        continue;
      }
    }

    // 3. Try GPT Image generation
    if (openaiKey) {
      const imagePrompt = `A professional, cinematic photograph for an Instagram carousel slide about: "${slide.headline.replace(/\\n/g, ' ')}". Style: editorial, high quality, moody lighting, suitable as a background with text overlay. No text in the image. Square format 1:1.`;
      const generatedUrl = await generateImageWithGPT(imagePrompt, openaiKey);
      if (generatedUrl) {
        imageUrls.push(generatedUrl);
        continue;
      }
    }

    // Fallback: empty (component will use solid color fallback)
    imageUrls.push('');
  }

  return imageUrls;
}
