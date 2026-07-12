import * as cheerio from 'cheerio';

export interface ExtractResult {
  title: string;
  content: string;
  images: string[];
}

function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('올바른 URL 형식이 아닙니다.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('HTTP 또는 HTTPS URL만 지원합니다.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (
    blocked.includes(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^169\.254\./.test(hostname)
  ) {
    throw new Error('접근할 수 없는 주소입니다.');
  }
}

export async function extractContent(url: string): Promise<ExtractResult> {
  validateUrl(url);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SocialSummaryBot/1.0)',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`페이지를 불러올 수 없습니다 (HTTP ${response.status})`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text() ||
    $('h1').first().text() ||
    '';

  // Extract images before cleanup
  const baseUrl = new URL(url);
  const images: string[] = [];

  // og:image first
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    try {
      images.push(new URL(ogImage, baseUrl).href);
    } catch { /* skip invalid URLs */ }
  }

  // Article/main body images — filter out avatars, logos, icons
  const skipClasses = /avatar|profile|author|byline|logo|icon|badge|thumb(nail)?-s/i;
  const skipUrlPatterns = /gravatar|avatar|logo|icon|favicon|badge|sprite|pixel|tracking/i;
  const imgSelectors = ['article img', 'main img', '.post-content img', '.article-content img', '.entry-content img'];
  for (const sel of imgSelectors) {
    $(sel).each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (!src) return;
      // Skip by class/parent class
      const cls = $(el).attr('class') || '';
      const parentCls = $(el).parent().attr('class') || '';
      if (skipClasses.test(cls) || skipClasses.test(parentCls)) return;
      try {
        const absUrl = new URL(src, baseUrl).href;
        // Skip URLs that look like avatars/icons
        if (skipUrlPatterns.test(absUrl)) return;
        // Skip small images — need at least 300px for slide backgrounds
        const width = parseInt($(el).attr('width') || '0', 10);
        const height = parseInt($(el).attr('height') || '0', 10);
        if ((width > 0 && width < 300) || (height > 0 && height < 300)) return;
        if (!images.includes(absUrl)) images.push(absUrl);
      } catch { /* skip invalid URLs */ }
    });
    if (images.length >= 10) break;
  }

  // 불필요한 요소 제거
  $('script, style, nav, header, footer, aside, iframe, noscript').remove();
  $('[class*="nav"], [class*="menu"], [class*="sidebar"], [class*="ad"], [id*="nav"], [id*="sidebar"]').remove();

  // 본문 추출 (article > main > body 순으로 시도)
  const mainSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    '#content',
    '#main',
  ];

  let contentEl = $();
  for (const sel of mainSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      contentEl = el;
      break;
    }
  }

  const rawText = (contentEl.length ? contentEl : $('body'))
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);

  if (!rawText) {
    throw new Error(
      '페이지에서 읽을 수 있는 내용을 찾지 못했습니다. JS 렌더링이 필요한 페이지일 수 있습니다.'
    );
  }

  return { title: title.trim(), content: rawText, images };
}
