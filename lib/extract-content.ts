import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ExtractResult {
  title: string;
  content: string;
}

export async function extractContent(url: string): Promise<ExtractResult> {
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
