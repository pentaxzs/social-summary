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

[슬라이드 수 결정]
기사의 핵심 아이디어 수 기준:
- 2~3개 → 4장 / 4개 → 5장 / 5개 이상 → 6장

[레이아웃 타입 - 반드시 지정]
layout 필드를 각 슬라이드에 명시하세요:
- "cover": 1번 슬라이드 전용. 제목 중심, 대형 헤드라인
- "stat": 기사에 강조할 수치·통계·핵심 지표가 있을 때 (예: 67%, 3배, 29분, 1조원)
- "content": 나머지 슬라이드

[accent_color 지정 - 반드시 포함]
background_color와 대비되는 포인트 색상:
- 어두운 배경 → 밝은 accent: #00c896, #60d394, #f5c518, #ff6b35, #7ecef4
- 밝은 배경 → 진한 accent: #1e6b4a, #1e3a5f, #7f1d1d, #4a1d96
전체 슬라이드에서 accent_color를 통일하세요 (1~2가지).

[JSON 출력 형식 - JSON만 반환, 다른 텍스트 없이]
{
  "title": "전체 포스트 제목",
  "slides": [
    {
      "slide_number": 1,
      "layout": "cover",
      "label": "카드뉴스",
      "headline": "2줄 이내 핵심 제목 (최대 20자)",
      "body": "한 줄 부제 (40자 이내, 선택)",
      "background_color": "#f5f5f0",
      "accent_color": "#1e6b4a"
    },
    {
      "slide_number": 2,
      "layout": "stat",
      "stat_badge": "STAT",
      "stat_value": "67",
      "stat_unit": "%",
      "headline": "수치 설명 (30자 이내)",
      "source": "출처명 (선택)",
      "background_color": "#0a0a0a",
      "accent_color": "#00c896"
    },
    {
      "slide_number": 3,
      "layout": "content",
      "keyword": "핵심 키워드",
      "headline": "슬라이드 제목 (15자 이내)",
      "body": "2~3줄 본문 내용. 줄바꿈은 \\n 사용.",
      "background_color": "#1e3a5f",
      "accent_color": "#7ecef4"
    }
  ],
  "caption": "해시태그 포함 270~330자 캡션"
}

[슬라이드 작성 규칙]
- cover: label은 "카드뉴스" 또는 주제 카테고리, headline은 2줄로 구성
- stat: stat_value는 숫자만(예: "67"), stat_unit은 단위(예: "%"), headline은 수치 설명
- content: keyword는 2~4자 짧은 단어, body는 핵심 내용 2~3줄
- 1번: 반드시 cover, 호기심 유발
- 마지막: content 레이아웃으로 핵심 정리 + 저장/공유 유도
- 원문 복사 금지 — 재구성 필수

[캡션 작성 규칙]
- 270~330자 (해시태그 포함)
- 첫 문장: 스크롤 멈추는 훅
- CTA: 저장/공유 유도
- 해시태그 5~7개: 한글 2~3개 + 영문 2~3개 혼용

[톤]
- 인사이트 있고 약간 도발적, 실용적
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
