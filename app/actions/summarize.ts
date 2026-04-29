'use server';

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { extractContent } from '@/lib/extract-content';
import {
  Provider,
  PROVIDERS,
  PlatformSummaries,
  SummarizeResponse,
  PLATFORM_LIMITS,
} from '@/lib/types';

function createModel(provider: Provider, apiKey: string) {
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(PROVIDERS.anthropic.defaultModel);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(PROVIDERS.google.defaultModel);
    case 'openai':
      return createOpenAI({ apiKey })(PROVIDERS.openai.defaultModel);
  }
}

const SUMMARY_PROMPT = (title: string, content: string) => `
다음 글을 4개 플랫폼에 맞게 요약해줘. 각 요약은 한국어로 작성하고 글자 수 제한을 반드시 지켜야 해. 한국어 맞춤법에 맞게 띄어쓰기를 정확히 지켜줘.

제목: ${title}

본문:
${content}

각 플랫폼 요약 요건:
- twitter: 200자 이상 ${PLATFORM_LIMITS.twitter}자 이하. 핵심만 담은 간결하고 임팩트 있는 문장.
- thread: 400자 이상 ${PLATFORM_LIMITS.thread}자 이하. 조금 더 상세하게, 대화체로.
- linkedin: 700자 이상 ${PLATFORM_LIMITS.linkedin}자 이하. 전문적인 톤. 반드시 아래 구조를 지켜줘:
  1) 서론: 문제 제기 또는 공감 유도 (1~2문장)
  2) 본론: 핵심 메시지와 인사이트 (2~3문장)
  3) 불릿: ✔ 형식으로 핵심 포인트 3개 내외 (각 포인트는 굵은 키워드 + 설명)
  4) 마무리: 독자 행동 유도 또는 인사이트 정리 (1~2문장)
  (링크는 포함하지 마. 자동으로 추가됨)
- geekNews: 800자 이상 ${PLATFORM_LIMITS.geekNews}자 이하. IT 커뮤니티 대상, 기술적 관점 강조, 핵심 기술/수치 포함. 주요 내용은 반드시 bullet(•) 형식으로 표현.

**, __, ## 같은 마크다운 문법은 절대 사용하지 마. 줄바꿈이 필요하면 실제 줄바꿈을 사용해.

반드시 아래 JSON 형식으로만 응답해 (다른 텍스트 없이):
{
  "twitter": "...",
  "thread": "...",
  "linkedin": "...",
  "geekNews": "..."
}
`.trim();

export async function summarizeUrl(
  url: string,
  provider: Provider,
  apiKey: string
): Promise<SummarizeResponse> {
  try {
    const { title, content } = await extractContent(url);
    const model = createModel(provider, apiKey);

    const { text } = await generateText({
      model,
      prompt: SUMMARY_PROMPT(title, content),
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.');
    }

    const summaries = JSON.parse(jsonMatch[0]) as PlatformSummaries;

    const requiredKeys: Array<keyof PlatformSummaries> = ['twitter', 'thread', 'linkedin', 'geekNews'];
    for (const key of requiredKeys) {
      if (typeof summaries[key] !== 'string') {
        throw new Error('AI가 올바른 형식으로 응답하지 않았습니다. 다시 시도해주세요.');
      }
      // 마크다운 제거 + 줄바꿈 정규화
      summaries[key] = summaries[key]
        .replace(/\*\*(.*?)\*\*/gs, '$1')  // **bold** → 텍스트만
        .replace(/__(.*?)__/gs, '$1')       // __bold__ → 텍스트만
        .replace(/^#{1,6}\s+/gm, '')        // ## 헤딩 제거
        .replace(/\\n/g, '\n')              // 리터럴 \n → 실제 줄바꿈
        .trim();
    }

    // 글자 수 초과 시 잘라내기 (안전장치)
    const keys = Object.keys(PLATFORM_LIMITS) as Array<keyof typeof PLATFORM_LIMITS>;
    for (const key of keys) {
      if (summaries[key].length > PLATFORM_LIMITS[key]) {
        summaries[key] = summaries[key].slice(0, PLATFORM_LIMITS[key]);
      }
    }

    // 원문 링크 추가 (LinkedIn은 utm_source 파라미터 포함)
    const linkedinUrl = url.includes('?')
      ? `${url}&utm_source=linkedin`
      : `${url}?utm_source=linkedin`;

    summaries.twitter = `${summaries.twitter}\n\n👉 ${url}`;
    summaries.thread = `${summaries.thread}\n\n👉 ${url}`;
    summaries.linkedin = `${summaries.linkedin}\n\n👉 ${linkedinUrl}`;
    summaries.geekNews = `${summaries.geekNews}\n\n👉 ${url}`;

    return { summaries };
  } catch (err: unknown) {
    let message = '알 수 없는 오류가 발생했습니다.';
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === 'string') {
      message = err;
    } else {
      try {
        message = JSON.stringify(err);
      } catch {
        message = '알 수 없는 오류가 발생했습니다.';
      }
    }
    return { error: message };
  }
}
