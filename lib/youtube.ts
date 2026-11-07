/**
 * 유튜브는 본문이 자바스크립트로 그려져서, 서버가 받아오는 HTML 에는
 * 영상 내용이 없다. 그대로 긁으면 푸터의 약관·저작권 문구 339자가 남고,
 * 그게 "본문"으로 넘어가 AI 가 유튜브 이용약관을 요약해버린다.
 *
 * 긁는 방식은 배포 환경에서 아예 통하지 않는다. 내 노트북에서는 설명란이
 * 멀쩡히 나오는데 Vercel 에서는 같은 요청에 captcha 안내가 섞인 다른
 * 페이지가 온다 — 데이터센터 IP 를 자동화 트래픽으로 보기 때문이다.
 * 로컬에서만 되는 길이라 믿고 쓸 수 없다.
 *
 * 자막도 쓸 수 없다. 자막 목록은 HTML 에 들어 있지만 실제 자막 파일을
 * 요청하면 200 에 빈 응답이 온다 (서명 파라미터를 요구하도록 막혀 있다).
 *
 * 그래서 정식 경로인 YouTube Data API 를 쓴다. 키가 없으면 긁어보고,
 * 막히면 왜 막혔는지 그대로 알려준다. 어느 쪽이든 모으는 것은 같다 —
 * 제목, 채널, 길이, 태그, 설명란. 영상을 본 것이 아니라는 점은
 * 본문 머리에 적어 둔다.
 */

const ID = /^[\w-]{11}$/;

/** 유튜브 주소면 영상 ID, 아니면 null */
export function youtubeVideoId(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return ID.test(id) ? id : null;
  }
  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'music.youtube.com') {
    return null;
  }
  const v = u.searchParams.get('v');
  if (v && ID.test(v)) return v;

  // /shorts/ID, /live/ID, /embed/ID
  const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/);
  return m ? m[1] : null;
}

/**
 * 문자열과 이스케이프를 존중하며 중괄호를 세어 객체 하나를 떼어낸다.
 * 정규식으로 자르면 설명란에 중괄호나 따옴표가 있을 때 깨진다.
 */
function sliceObject(html: string, marker: string): string | null {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = html.indexOf('{', at + marker.length - 1);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  return null;
}

interface VideoDetails {
  title?: string;
  author?: string;
  lengthSeconds?: string;
  keywords?: string[];
  shortDescription?: string;
}

export interface YoutubeDoc {
  title: string;
  content: string;
}

interface VideoFacts {
  title: string;
  author?: string;
  seconds?: number;
  keywords?: string[];
  description: string;
}

/** ISO 8601 (PT25M41S) → 초 */
function isoToSeconds(iso: string | undefined): number | undefined {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return undefined;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

const NO_DESCRIPTION =
  '이 영상은 설명란이 거의 비어 있어 요약할 내용이 없습니다. '
  + '영상 내용은 자막을 받아올 수 없어 읽지 못합니다.';

const BLOCKED =
  '유튜브가 서버에서 온 요청을 막았습니다. 영상 정보를 읽으려면 '
  + 'YouTube Data API 키가 필요합니다. 주소창 아래 칸에 넣어주세요.';

function buildDoc(f: VideoFacts): YoutubeDoc {
  if (f.description.trim().length < 80) throw new Error(NO_DESCRIPTION);

  const runtimeText = f.seconds && f.seconds > 0
    ? (f.seconds >= 60 ? `${Math.floor(f.seconds / 60)}분 ${f.seconds % 60}초` : `${f.seconds}초`)
    : null;

  const facts = [
    `제목: ${f.title}`,
    f.author ? `채널: ${f.author}` : null,
    runtimeText ? `길이: ${runtimeText}` : null,
    f.keywords?.length ? `태그: ${f.keywords.slice(0, 12).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const content = [
    '[이 자료는 유튜브 영상에 딸린 정보다. 영상을 본 것이 아니고 자막도 없다.',
    ' 아래 설명란에 적힌 내용까지만 쓸 수 있다. 영상에서 무엇을 보여주는지,',
    ' 어떤 장면이 나오는지 지어내지 마라.]',
    '',
    facts,
    '',
    '설명란:',
    f.description.trim(),
  ].join('\n').slice(0, 8000);

  return { title: f.title, content };
}

/** 정식 경로. 데이터센터에서도 막히지 않는다 */
async function fetchViaApi(id: string, apiKey: string): Promise<YoutubeDoc> {
  const params = new URLSearchParams({
    part: 'snippet,contentDetails',
    id,
    key: apiKey,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const message = (() => {
      try { return JSON.parse(body)?.error?.message as string | undefined; } catch { return undefined; }
    })();
    if (res.status === 400 || res.status === 403) {
      throw new Error(`YouTube Data API 키를 거부했습니다: ${message || `HTTP ${res.status}`}`);
    }
    throw new Error(`유튜브 정보를 불러오지 못했습니다 (HTTP ${res.status})`);
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) {
    throw new Error('영상을 찾지 못했습니다. 비공개이거나 삭제된 영상일 수 있습니다.');
  }

  return buildDoc({
    title: (item.snippet?.title || '').trim(),
    author: item.snippet?.channelTitle,
    seconds: isoToSeconds(item.contentDetails?.duration),
    keywords: item.snippet?.tags,
    description: item.snippet?.description || '',
  });
}

export async function fetchYoutube(id: string, apiKey?: string): Promise<YoutubeDoc> {
  if (apiKey) return fetchViaApi(id, apiKey);

  const res = await fetch(`https://www.youtube.com/watch?v=${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SocialSummaryBot/1.0)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`유튜브 페이지를 불러올 수 없습니다 (HTTP ${res.status})`);
  }

  const html = await res.text();
  const raw = sliceObject(html, '"videoDetails":');
  if (!raw) throw new Error(BLOCKED);

  let details: VideoDetails;
  try {
    details = JSON.parse(raw) as VideoDetails;
  } catch {
    throw new Error(BLOCKED);
  }

  // 차단된 페이지에도 videoDetails 라는 글자는 있지만 설명란은 없다.
  // 설명란이 통째로 빠진 것과 원래 짧은 것을 구분해야 안내가 맞는다
  if (typeof details.shortDescription !== 'string') throw new Error(BLOCKED);

  return buildDoc({
    title: (details.title || '').trim(),
    author: details.author,
    seconds: Number(details.lengthSeconds) || undefined,
    keywords: details.keywords,
    description: details.shortDescription,
  });
}
