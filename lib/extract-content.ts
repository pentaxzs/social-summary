import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ExtractResult {
  title: string;
  content: string;
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
  const blocked = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
  ];
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
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article || !article.textContent?.trim()) {
    throw new Error(
      '페이지에서 읽을 수 있는 내용을 찾지 못했습니다. JS 렌더링이 필요한 페이지일 수 있습니다.'
    );
  }

  return {
    title: article.title ?? '',
    content: article.textContent.trim().slice(0, 8000),
  };
}
