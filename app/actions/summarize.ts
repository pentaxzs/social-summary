'use server';

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { extractContent } from '@/lib/extract-content';
import { assignImagesToSlides } from './image-sources';
import {
  Provider,
  PROVIDERS,
  PlatformSummaries,
  TextPlatform,
  Platform,
  InstagramPost,
  InstagramPhotoPost,
  InstagramPhotoSlide,
  SummarizeResponse,
  RegenerateMode,
  TONES,
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

/** 한 번의 JSON 호출로 함께 만드는 한국어 플랫폼들. Reddit 은 여기 끼지 않는다 */
type JsonPlatform = Exclude<TextPlatform, 'reddit'>;

const PLATFORM_INSTRUCTIONS: Record<JsonPlatform, string> = {
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

const SUMMARY_PROMPT = (title: string, content: string, platforms: JsonPlatform[]) => `
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

/**
 * Reddit 은 이 앱에서 유일한 영문·해외 독자용 카드다.
 *
 * 다른 카드처럼 한국어 요약을 만드는 일이 아니라, 원문에서 쓸 만한 것만
 * 골라 영어권 커뮤니티에 올릴 글로 다시 쓰는 일이다. 그래서 같은 JSON
 * 호출에 섞지 않고 따로 부른다 — 언어도 길이 기준도 마크다운 허용 여부도
 * 전부 다르다.
 *
 * 레딧을 직접 둘러볼 수 없으므로 커뮤니티 규칙과 플레어는 확인할 방법이
 * 없다. 지어내지 않고 Unverified 로 돌려주게 한다.
 */
const REDDIT_PROMPT = (title: string, content: string, url: string, extra?: string) => `
You are adapting a source article into a Reddit post for an English-speaking, global audience.
This is not a translation and not a summary. Take what is genuinely useful in the source and
rewrite it as a post a real person would publish.

SOURCE
Title: ${title}
URL: ${url}
Body:
${content}

READING THE SOURCE
- Find its main argument, who it is for, and what in it is actually new.
- Keep concrete experience, evidence, examples, lessons, technical detail and stated limits.
- Separate verified fact from opinion. Note whether the author describes their own work or
  someone else's, and preserve attribution.
- Never invent results, numbers, personal experience or product capability. If the source does
  not say it, it does not go in the post.

WHO IT IS FOR
- Write for the subreddit where this would actually land, but do not name it in the output.
  Knowing the audience shapes the post; recommending a community is not your job here.
- You cannot browse Reddit, so you do not know any community's current rules, permitted post
  types or flairs. Never state a rules status, never name a flair, never claim a post type is
  allowed. Leave all of that out rather than guessing at it.
- If this kind of post is widely restricted — self-promotion, AI-written content, blog links —
  say so under NOTICE, in Korean. Do not disguise promotion to get around a rule.

VOICE
- Natural conversational English. Write like a practitioner, not a brand.
- First person only when the source supports it and the author is the one posting.
- Specific observations over sweeping claims. Direct and informative, never sensational.
- No corporate jargon, no marketing lines, no generic AI opener, no exaggeration.
- Do not insert a personal anecdote that is not in the source. No emoji, no hashtags.

TITLES — three options, one of each kind
1. Experience-driven  2. Problem-driven  3. Insight-driven
Aim for 45-100 characters. Descriptive, specific, honest about what the post contains.
No clickbait, no ALL CAPS.

STRUCTURE — pick the one that fits the source, do not force it
Experience / Build log:  Hook -> Problem -> Experiment -> Lessons -> Discussion
Insight / Opinion:       Observation -> Argument -> Evidence -> Implications -> Question
Resource / Tutorial:     Problem -> Solution -> Usage -> Limitations -> Resource
Discussion:              Context -> Finding -> Perspectives -> Specific question

LENGTH
Standard 250-500 words. Short 120-250. Deep dive 500-900. Use Standard unless told otherwise.
Short paragraphs. Reddit markdown headings and lists only where they earn their place.
Substance over hitting a word count.

KEEP / CUT
Keep the problem, the unique insight, concrete evidence, real limitations, practical lessons.
Cut repeated explanation, generic background, promotional language, subscribe or follow asks,
duplicate links, and any claim the source does not support.

LINKS
The source URL is the one link that always belongs there — it is where the post came from and
the reader's way back to it. Add others only when the source itself points to them and they
are worth opening: a repository, a demo, a paper, the original article behind the source.
Do not invent a link, and do not add one the source never mentions. Disclose authorship or
commercial interest where it applies. No shorteners, no misleading redirects. Never suggest
hiding a link in the comments.

CLOSING
End with one specific, genuine question when a question fits — one that invites practical
experience, an alternative approach, or informed disagreement. Never "What do you think?"
and never ask for upvotes.

Then, below that, close the post body itself with the source link, and — only when the source
is not written in English — one short line saying the original is in that language and that
browser translation reads it fine. Write that line in your own words, plainly, no apology.
It belongs to the post, not to the notes below it.

BEFORE ANSWERING, CHECK
Faithful to the source. Relevant to that community. Factually accurate. Natural English. Clear
structure. Low promotional intensity. Useful. Right length. Worth replying to.
If the source contradicts itself, or you had to guess at anything, put it under NOTICE — in
Korean — rather than smoothing it over.${extra ? `

THIS TIME
${extra}` : ''}

OUTPUT
Reply with exactly these sections, in this order, with these headers, and nothing else.
Do not add a section for anything you cannot actually determine from here.

TITLES, POST and LINKS are what gets posted, so they are written in English.
The divider line and the two sections after it are for the Korean author to read before
posting — write those in Korean, and copy the divider exactly as given. They never go into
the post.

TITLES
1. <experience-driven>
2. <problem-driven>
3. <insight-driven>

POST
<the complete post body, ready to paste, ending with the source link
 and the translation line when the source is not in English>

LINKS
- <the source URL> — the article this post came from
- <any further link the source itself points to> — what it is

--- 여기부터는 올리기 전 확인용입니다. 글에는 넣지 마세요 ---

WHAT CHANGED
(한국어로) 원문에서 무엇을 강조하고, 줄이고, 뺐는지와 그 이유. 요약이 원문에서
벗어나지 않았는지 글쓴이가 판단할 수 있게 두세 줄로 적는다.

NOTICE
(한국어로) 올리기 전에 확인하거나 고쳐야 할 것. 실제로 아는 것만 적는다 — 원문이
뒷받침하지 않는 주장, 추측으로 메운 부분, 글쓴이가 밝혀야 할 이해관계, 널리 제한되는
종류의 글인 경우. 없으면 "없음"이라고만 적는다. 서브레딧 규칙을 확인하라는 식의
일반론으로 채우지 마라.
`.trim();

/** Reddit 은 영문이라 다시 만들기 지시도 영문이어야 한다 */
const REDDIT_REGENERATE_INSTRUCTIONS: Record<RegenerateMode, string> = {
  regenerate: 'Write it again from a different angle. New opening, different structure, no sentence reused.',
  shorter: 'Use the Short length: 120-250 words in the post body. Cut material out; do not pack the same content into denser sentences.',
  ...Object.fromEntries(TONES.map((t) => [t.key, t.english])),
} as Record<RegenerateMode, string>;

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
  headline: 한 줄 최대 7자, 반드시 2줄로 구성, 줄바꿈은 \\n 사용
            강조할 단어 하나를 *별표*로 감싼다 (크게 그려짐)
            예) "AI가 바꾸는\\n*세상의 규칙*"
  body:     최대 26자 (1줄)  예) "지금 알아야 할 5가지 변화"

content:
  keyword:  최대 5자   예) "핵심", "배경", "결론", "전망"
  headline: 한 줄 최대 8자, 1~2줄. 2줄일 경우 \\n 사용
            강조할 단어 하나를 *별표*로 감싼다
            예) "왜 *지금*\\n중요한가"
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
      "headline": "AI가 바꾸는\\n*세상의 규칙*",
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
      "headline": "왜 *지금*\\n중요한가",
      "body": "기존 방식으로는 한계에\\n도달했다. 새로운 접근이\\n필요한 시점이다.",
      "background_color": "#1e3a5f",
      "accent_color": "#7ecef4"
    }
  ],
  "caption": "해시태그 포함 270~330자 캡션",
  "next_story": "다음 편 예고를\\n두 줄로"
}

[next_story — 다음 편 예고]
- 뉴스레터나 연재 글은 말미에 다음 편 예고를 3~4줄 적어두는 경우가 많다
- 그런 예고가 본문에 있으면 카드에 들어갈 수 있게 2줄로 줄여라
  · 한 줄 최대 13자, 줄바꿈은 \\n 사용, 반드시 2줄
  · 가장 끌리는 단어 하나를 *별표*로 감싼다
  · 예) "다음 편엔 *AI 툴*\\n고르는 기준 5가지"
- 예고가 없으면 next_story 를 빈 문자열("")로 둔다. 지어내지 마라

[강조 표시 — 중요]
- cover 와 content 의 headline 에는 *별표*로 감싼 강조 구간이 정확히 1개 있어야 한다
- 강조 구간은 2~5자. 문장에서 가장 핵심이 되는 명사나 숫자를 고른다
- 강조 구간은 더 크고 다른 색으로 그려지므로, 글자 수 제한에 포함해 세어야 한다
- body, label, keyword, source 에는 별표를 쓰지 않는다

[추가 규칙]
- 원문 문장 복사 금지 — 재구성 필수
- 빈 칸 금지. cover 에는 label·headline·body 가, content 에는 keyword·headline·body 가
  모두 있어야 한다. 하나라도 비우거나 생략하면 카드에 빈 자리가 남는다
- body 는 60자를 넘기지 않는다. 사진이 들어가는 카드에서는 글 자리가 좁다
- stat 슬라이드는 수치가 있을 때만 사용 (없으면 content로 대체)
- 마지막 슬라이드: "저장하고 나중에 다시 봐요" 류의 CTA 포함
- 캡션: 첫 문장 훅 + 인사이트 + CTA + 한글/영문 해시태그 5~7개
`.trim();


function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([\s\S]*?)\*\*/g, '$1')
    .replace(/__([\s\S]*?)__/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\\n/g, '\n')
    .trim();
}

/** 플랫폼별 원문 링크. LinkedIn만 utm 을 붙인다 */
function withSourceLink(platform: TextPlatform, text: string, url: string): string {
  if (platform === 'linkedin') {
    const linkedinUrl = url.includes('?') ? `${url}&utm_source=linkedin` : `${url}?utm_source=linkedin`;
    return `${text}\n\n👉 ${linkedinUrl}`;
  }
  return `${text}\n\n👉 ${url}`;
}

export async function summarizeUrl(
  url: string,
  provider: Provider,
  apiKey: string,
  selectedPlatforms: Platform[],
  unsplashKey?: string,
  openaiImageKey?: string,
  youtubeKey?: string,
): Promise<SummarizeResponse> {
  try {
    const { title, content } = await extractContent(url, youtubeKey);
    const model = createModel(provider, apiKey);

    const textPlatforms = selectedPlatforms.filter(
      (p): p is JsonPlatform => p !== 'instagram' && p !== 'instagramPhoto' && p !== 'reddit',
    );
    const includeInstagram = selectedPlatforms.includes('instagram');
    const includeInstagramPhoto = selectedPlatforms.includes('instagramPhoto');
    const includeReddit = selectedPlatforms.includes('reddit');

    // 선택된 플랫폼만 병렬 호출
    const [textResult, instaResult, instaPhotoTextResult, redditResult] = await Promise.allSettled([
      textPlatforms.length > 0
        ? generateText({ model, prompt: SUMMARY_PROMPT(title, content, textPlatforms) })
        : Promise.resolve(null),
      includeInstagram
        ? generateText({ model, prompt: INSTAGRAM_PROMPT(title, content) })
        : Promise.resolve(null),
      includeInstagramPhoto
        ? generateText({ model, prompt: INSTAGRAM_PROMPT(title, content) })
        : Promise.resolve(null),
      includeReddit
        ? generateText({ model, prompt: REDDIT_PROMPT(title, content, url) })
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
        summaries[key] = stripMarkdown(parsed[key]!);
      }

      // 글자 수 초과 시 문장 단위로 잘라내기
      for (const key of textPlatforms) {
        if (summaries[key]!.length > PLATFORM_LIMITS[key]) {
          summaries[key] = truncateAtSentence(summaries[key]!, PLATFORM_LIMITS[key]);
        }
      }

      // 원문 링크 추가
      for (const key of textPlatforms) {
        summaries[key] = withSourceLink(key, summaries[key]!, url);
      }
    }

    // Reddit — 영문 구조 출력이라 마크다운을 지우거나 문장 단위로 자르면 망가진다.
    // 링크도 프롬프트가 알아서 고르므로 뒤에 붙이지 않는다
    if (includeReddit) {
      if (redditResult.status === 'rejected') {
        if (textPlatforms.length === 0 && !includeInstagram && !includeInstagramPhoto) {
          throw redditResult.reason;
        }
      } else if (redditResult.value) {
        const text = redditResult.value.text.trim();
        if (text) summaries.reddit = text;
      }
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

    // Instagram Photo 파싱 + 이미지 매칭
    let instagramPhotoPost: InstagramPhotoPost | null = null;
    if (includeInstagramPhoto) {
      if (instaPhotoTextResult.status === 'rejected') {
        if (textPlatforms.length === 0 && !includeInstagram) throw instaPhotoTextResult.reason;
      } else if (instaPhotoTextResult.status === 'fulfilled' && instaPhotoTextResult.value) {
        try {
          const photoMatch = instaPhotoTextResult.value.text.match(/\{[\s\S]*\}/);
          if (photoMatch) {
            const parsed = JSON.parse(photoMatch[0]) as InstagramPost;
            if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
              // 원문 기사 이미지는 쓰지 않는다 — image-sources 의 주석 참고
              const imageUrls = await assignImagesToSlides(
                parsed.slides,
                unsplashKey,
                openaiImageKey,
              );
              const photoSlides: InstagramPhotoSlide[] = parsed.slides.map((slide, i) => ({
                ...slide,
                image_url: imageUrls[i] || '',
              }));
              instagramPhotoPost = {
                title: parsed.title,
                slides: photoSlides,
                caption: parsed.caption,
              };
            }
          }
        } catch {
          // 파싱 실패 시 null 유지
        }
      }
    }

    return { summaries, instagramPost, instagramPhotoPost, source: { title, content } };
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

const REGENERATE_INSTRUCTIONS: Record<RegenerateMode, string> = {
  regenerate: '같은 내용을 다른 각도에서 새로 써줘. 앞선 결과와 문장 구성이 겹치지 않게.',
  shorter: '핵심만 남기고 눈에 띄게 짧게 줄여줘. 문장 수를 줄이되 문장은 끝맺어야 해.',
  ...Object.fromEntries(TONES.map((t) => [t.key, t.instruction])),
} as Record<RegenerateMode, string>;

export interface RegenerateResponse {
  text?: string;
  error?: string;
}

/**
 * 카드 하나만 다시 만든다.
 * 원문(title/content)은 클라이언트가 첫 생성 때 받아 들고 있으므로 재크롤링하지 않는다.
 */
export async function regenerateSummary(
  platform: TextPlatform,
  mode: RegenerateMode,
  source: { title: string; content: string },
  url: string,
  provider: Provider,
  apiKey: string,
): Promise<RegenerateResponse> {
  try {
    const model = createModel(provider, apiKey);

    if (platform === 'reddit') {
      const extra = REDDIT_REGENERATE_INSTRUCTIONS[mode];
      if (!extra) return { error: '알 수 없는 요청입니다.' };
      const result = await generateText({
        model,
        prompt: REDDIT_PROMPT(source.title, source.content, url, extra),
      });
      const text = result.text.trim();
      if (!text) return { error: 'AI가 빈 응답을 반환했습니다. 다시 시도해주세요.' };
      return { text };
    }

    const modifier = REGENERATE_INSTRUCTIONS[mode];
    if (!modifier) return { error: '알 수 없는 요청입니다.' };

    const limit = PLATFORM_LIMITS[platform];

    const prompt = `
다음 글을 ${PLATFORM_INSTRUCTIONS[platform].replace(/^- \w+: /, '')} 형식에 맞춰 한국어로 다시 요약해줘.

제목: ${source.title}

본문:
${source.content}

추가 지시: ${modifier}

반드시 ${limit}자 이하로 쓰고, 한국어 맞춤법과 띄어쓰기를 지켜줘.
**, __, ## 같은 마크다운 문법은 절대 쓰지 마. 줄바꿈이 필요하면 실제 줄바꿈을 써.
원문 링크는 넣지 마. 자동으로 붙는다.

요약문만 출력해. 다른 설명이나 따옴표 없이.
`.trim();

    const result = await generateText({ model, prompt });

    let text = stripMarkdown(result.text);
    if (!text) return { error: 'AI가 빈 응답을 반환했습니다. 다시 시도해주세요.' };
    if (text.length > limit) text = truncateAtSentence(text, limit);

    return { text: withSourceLink(platform, text, url) };
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : '';
    if (/401|authentication|invalid.*key|api.?key|unauthorized/i.test(raw)) {
      return { error: 'API 키가 올바르지 않습니다. 키를 확인하고 다시 시도해주세요.' };
    }
    return { error: raw || '다시 만드는 중 오류가 발생했습니다.' };
  }
}
