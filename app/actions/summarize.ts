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

[슬라이드 수 - 반드시 5~7장]
- 핵심 아이디어 2~3개 → 5장
- 핵심 아이디어 4개 → 6장
- 핵심 아이디어 5개 이상 → 7장
(1번=cover 훅, 마지막=content 정리/CTA, 중간=content+stat 혼합)

[레이아웃 타입]
- "cover": 1번 전용. 대형 제목 중심
- "stat": 강조할 수치·통계가 있을 때 (%, 배, 분, 원 단위 등)
- "content": 나머지

[accent_color]
배경과 대비되는 포인트색. 전체 슬라이드 통일:
- 어두운 배경 → #00c896 / #f5c518 / #7ecef4 / #ff6b35
- 밝은 배경 → #1e6b4a / #1e3a5f / #7f1d1d / #4a1d96

[레이아웃별 글자 수 제한 — 카드 레이아웃 균형을 위해 반드시 준수]

cover:
  label:    최대 10자  예) "카드뉴스", "IT 트렌드"
  headline: 한 줄 최대 11자, 반드시 2줄로 구성, 줄바꿈은 \\n 사용
            예) "AI가 바꾸는\\n세상의 규칙"
  body:     최대 26자 (1줄)  예) "지금 알아야 할 5가지 변화"

content:
  keyword:  최대 5자   예) "핵심", "배경", "결론", "전망"
  headline: 한 줄 최대 12자, 1~2줄. 2줄일 경우 \\n 사용
            예) "왜 지금\\n중요한가"
  body:     한 줄 최대 20자, 2~3줄, 줄바꿈은 \\n 사용
            예) "기존 방식으로는 한계에\\n도달했다. 새로운 접근이\\n필요한 시점이다."

stat:
  stat_badge:  최대 6자   예) "STAT", "KEY", "수치"
  stat_value:  최대 5자   예) "67", "3.5", "1200"  (단위 제외 숫자만)
  stat_unit:   최대 3자   예) "%", "분", "배", "억"
  headline:    최대 24자  (수치 설명 1줄)
  source:      최대 18자  예) "McKinsey 2024"

[JSON 출력 형식 - JSON만 반환, 다른 텍스트 없이]
{
  "title": "전체 포스트 제목",
  "slides": [
    {
      "slide_number": 1,
      "layout": "cover",
      "label": "카드뉴스",
      "headline": "AI가 바꾸는\\n세상의 규칙",
      "body": "지금 알아야 할 5가지 변화",
      "background_color": "#f5f5f0",
      "accent_color": "#1e6b4a"
    },
    {
      "slide_number": 2,
      "layout": "stat",
      "stat_badge": "STAT",
      "stat_value": "67",
      "stat_unit": "%",
      "headline": "기업 중 AI 도입 완료 비율",
      "source": "McKinsey 2024",
      "background_color": "#0a0a0a",
      "accent_color": "#00c896"
    },
    {
      "slide_number": 3,
      "layout": "content",
      "keyword": "배경",
      "headline": "왜 지금\\n중요한가",
      "body": "기존 방식으로는 한계에\\n도달했다. 새로운 접근이\\n필요한 시점이다.",
      "background_color": "#1e3a5f",
      "accent_color": "#7ecef4"
    }
  ],
  "caption": "해시태그 포함 270~330자 캡션"
}

[추가 규칙]
- 원문 문장 복사 금지 — 재구성 필수
- stat 슬라이드는 수치가 있을 때만 사용 (없으면 content로 대체)
- 마지막 슬라이드: "저장하고 나중에 다시 봐요" 류의 CTA 포함
- 캡션: 첫 문장 훅 + 인사이트 + CTA + 한글/영문 해시태그 5~7개
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

    // Instagram 파싱
    let instagramPost: InstagramPost | null = null;
    if (includeInstagram) {
      if (instaResult.status === 'rejected') {
        // Instagram만 선택한 경우 에러 전파
        if (textPlatforms.length === 0) throw instaResult.reason;
        // 텍스트 성공 + Instagram 실패 → 텍스트 결과만 반환
      } else if (instaResult.status === 'fulfilled' && instaResult.value) {
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
    }

    return { summaries, instagramPost };
  } catch (err: unknown) {
    const FALLBACK = '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.';
    let message = FALLBACK;
    if (err instanceof Error) {
      const raw = err.message || '';
      // API 인증 오류 감지 (401, authentication, invalid key 등)
      if (/401|authentication|invalid.*key|api.?key|unauthorized/i.test(raw)) {
        message = 'API 키가 올바르지 않습니다. 키를 확인하고 다시 시도해주세요.';
      } else {
        message = raw || FALLBACK;
      }
    } else if (typeof err === 'string') {
      message = err || FALLBACK;
    } else {
      try {
        message = JSON.stringify(err) || FALLBACK;
      } catch {
        message = FALLBACK;
      }
    }
    return { error: message };
  }
}
