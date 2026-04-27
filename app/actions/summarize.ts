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
다음 글을 4개 플랫폼에 맞게 요약해줘. 각 요약은 한국어로 작성하고 글자 수 제한을 반드시 지켜야 해.

제목: ${title}

본문:
${content}

각 플랫폼 요약 요건:
- twitter: 최대 ${PLATFORM_LIMITS.twitter}자. 핵심만 담은 간결하고 임팩트 있는 문장.
- thread: 최대 ${PLATFORM_LIMITS.thread}자. 조금 더 상세하게, 대화체로.
- linkedin: 최대 ${PLATFORM_LIMITS.linkedin}자. 전문적인 톤, 인사이트 강조.
- geekNews: 최대 ${PLATFORM_LIMITS.geekNews}자. IT 커뮤니티 대상, 기술적 관점 강조, 핵심 기술/수치 포함.

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

    // 글자 수 초과 시 잘라내기 (안전장치)
    const keys = Object.keys(PLATFORM_LIMITS) as Array<keyof typeof PLATFORM_LIMITS>;
    for (const key of keys) {
      if (summaries[key].length > PLATFORM_LIMITS[key]) {
        summaries[key] = summaries[key].slice(0, PLATFORM_LIMITS[key]);
      }
    }

    return { summaries };
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
    return { error: message };
  }
}
