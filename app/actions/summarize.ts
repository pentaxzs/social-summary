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
  TextPlatform,
  Platform,
  InstagramPost,
  SummarizeResponse,
  PLATFORM_LIMITS,
} from '@/lib/types';

function truncateAtSentence(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit);
  for (let i = slice.length - 1; i >= Math.floor(limit * 0.6); i--) {
    if (slice[i] === '.' || slice[i] === '!' || slice[i] === '?') {
      return slice.slice(0, i + 1).trim();
    }
  }
  return slice.trim();
}

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

const PLATFORM_INSTRUCTIONS: Record<TextPlatform, string> = {
  twitter: `- twitter: 200자 이상 ${PLATFORM_LIMITS.twitter}자 이하. 핵심만 담은 간결하고 임팩트 있는 문장.`,
  thread: `- thread: 400자 이상 ${PLATFORM_LIMITS.thread}자 이하. 조금 더 상세하게, 대화체로.`,
  linkedin: `- linkedin: 700자 이상 ${PLATFORM_LIMITS.linkedin}자 이하. 전문적인 톤. 반드시 아래 구조를 지켜줘:
  1) 서론: 문제 제기 또는 공감 유도 (1~2문장)
  2) 본론: 핵심 메시지와 인사이트 (2~3문장)
  3) 불릿: ✔ 형식으로 핵심 포인트 3개 내외 (각 포인트는 굵은 키워드 + 설명)
  4) 마무리: 독자 행동 유도 또는 인사이트 정리 (1~2문장)
  (링크는 포함하지 마. 자동으로 추가됨)`,
  geekNews: `- geekNews: 1000자 이상 ${PLATFORM_LIMITS.geekNews}자 이하. IT 커뮤니티 대상, 기술적 관점 강조, 핵심 기술/수치 포함. 주요 내용은 반드시 bullet(•) 형식으로 표현.`,
};

const SUMMARY_PROMPT = (title: string, content: string, platforms: TextPlatform[]) => `
다음 글을 ${platforms.length}개 플랫폼에 맞게 요약해줘. 각 요약은 한국어로 작성하고 글자 수 제한을 반드시 지켜야 해. 한국어 맞춤법에 맞게 띄어쓰기를 정확히 지켜줘.

제목: ${title}

본문:
${content}

각 플랫폼 요약 요건:
${platforms.map((p) => PLATFORM_INSTRUCTIONS[p]).join('\n')}

**, __, ## 같은 마크다운 문법은 절대 사용하지 마. 줄바꿈이 필요하면 실제 줄바꿈을 사용해.

반드시 아래 JSON 형식으로만 응답해 (다른 텍스트 없이):
{
${platforms.map((p) => `  "${p}": "..."`).join(',\n')}
}
`.trim();

const INSTAGRAM_PROMPT = (title: string, content: string) => `
당신은 인스타그램 카드뉴스 전문 콘텐츠 기획자입니다.
아래 기사를 인스타그램 캐러셀 카드뉴스로 변환하세요. 모든 출력은 한국어로 작성합니다.

기사 제목: ${title}

기사 본문:
${content}

[슬라이드 수 결정 기준]
기사에서 핵심 아이디어/포인트의 수를 파악하세요:
- 핵심 아이디어 2~3개 → 4장
- 핵심 아이디어 4개 → 5장
- 핵심 아이디어 5개 이상 → 6장
(1번 슬라이드는 항상 훅/도입, 마지막 슬라이드는 항상 정리/CTA)

[배경색 선택 기준]
콘텐츠 무드에 맞는 색상을 선택하세요:
- 기술/혁신: #1e3a5f, #0f4c81, #1a365d
- 성장/긍정: #2d6a4f, #1b4332, #386641
- 긴급/중요: #7f1d1d, #831843, #78350f
- 크리에이티브: #4a1d96, #5b21b6, #3730a3
- 비즈니스: #1f2937, #374151, #1e3a5f
슬라이드마다 같은 팔레트에서 명도를 달리해 통일감을 유지하세요.

[출력 형식 - JSON만 반환, 다른 텍스트 없이]
{
  "title": "전체 포스트 제목",
  "slides": [
    {
      "slide_number": 1,
      "headline": "훅 헤드라인 (최대 20자)",
      "body": "보조 문장 (선택, 40자 이내)",
      "background_color": "#16213e"
    }
  ],
  "caption": "해시태그 포함 270~330자 인스타그램 본문 캡션"
}

[슬라이드 작성 규칙]
- 1번: 호기심이나 긴장감을 만드는 훅 (왜 이걸 봐야 하지?)
- 중간: 슬라이드 하나 = 핵심 아이디어 하나
- 마지막: 핵심 정리 + 저장/공유 유도
- 짧고 강한 한국어 문장 사용
- 원문 문장 복사 금지 — 재구성 필수

[캡션 작성 규칙]
- 270~330자 사이 (해시태그 포함)
- 첫 문장: 스크롤을 멈추게 하는 훅
- 2~4문장: 핵심 인사이트 전달
- CTA: 저장/공유 유도 문구
- 해시태그 5~7개: 한글 2~3개 + 영문 2~3개 혼용

[톤]
- 인사이트 있고 약간 도발적
- 실용적이고 쉬운 언어
- 리포트가 아닌 바이럴 콘텐츠처럼
`.trim();

export async function summarizeUrl(
  url: string,
  provider: Provider,
  apiKey: string,
  selectedPlatforms: Platform[]
): Promise<SummarizeResponse> {
  try {
    const { title, content } = await extractContent(url);
    const model = createModel(provider, apiKey);

    const textPlatforms = selectedPlatforms.filter((p): p is TextPlatform => p !== 'instagram');
    const includeInstagram = selectedPlatforms.includes('instagram');

    // 선택된 플랫폼만 병렬 호출
    const [textResult, instaResult] = await Promise.allSettled([
      textPlatforms.length > 0
        ? generateText({ model, prompt: SUMMARY_PROMPT(title, content, textPlatforms) })
        : Promise.resolve(null),
      includeInstagram
        ? generateText({ model, prompt: INSTAGRAM_PROMPT(title, content) })
        : Promise.resolve(null),
    ]);

    const summaries: Partial<PlatformSummaries> = {};

    // 텍스트 플랫폼 파싱
    if (textPlatforms.length > 0) {
      if (textResult.status === 'rejected') throw textResult.reason;
      const result = textResult.value;
      if (!result) throw new Error('AI 응답이 없습니다. 다시 시도해주세요.');

      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.');

      const parsed = JSON.parse(jsonMatch[0]) as Partial<PlatformSummaries>;

      for (const key of textPlatforms) {
        if (typeof parsed[key] !== 'string') {
          throw new Error('AI가 올바른 형식으로 응답하지 않았습니다. 다시 시도해주세요.');
        }
        summaries[key] = parsed[key]!
          .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
          .replace(/__([\s\S]*?)__/g, '$1')
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\\n/g, '\n')
          .trim();
      }

      // 글자 수 초과 시 문장 단위로 잘라내기
      for (const key of textPlatforms) {
        if (summaries[key]!.length > PLATFORM_LIMITS[key]) {
          summaries[key] = truncateAtSentence(summaries[key]!, PLATFORM_LIMITS[key]);
        }
      }

      // 원문 링크 추가
      const linkedinUrl = url.includes('?')
        ? `${url}&utm_source=linkedin`
        : `${url}?utm_source=linkedin`;

      if (summaries.twitter) summaries.twitter = `${summaries.twitter}\n\n👉 ${url}`;
      if (summaries.thread) summaries.thread = `${summaries.thread}\n\n👉 ${url}`;
      if (summaries.linkedin) summaries.linkedin = `${summaries.linkedin}\n\n👉 ${linkedinUrl}`;
      if (summaries.geekNews) summaries.geekNews = `${summaries.geekNews}\n\n👉 ${url}`;
    }

    // Instagram 파싱 (실패해도 텍스트 결과에 영향 없음)
    let instagramPost: InstagramPost | null = null;
    if (includeInstagram && instaResult.status === 'fulfilled' && instaResult.value) {
      try {
        const instaMatch = instaResult.value.text.match(/\{[\s\S]*\}/);
        if (instaMatch) {
          const parsed = JSON.parse(instaMatch[0]) as InstagramPost;
          if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
            instagramPost = parsed;
          }
        }
      } catch {
        // 파싱 실패 시 null 유지
      }
    }

    return { summaries, instagramPost };
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
