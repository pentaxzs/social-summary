/**
 * 유튜브는 본문이 자바스크립트로 그려져서, 서버가 받아오는 HTML 에는
 * 영상 내용이 없다. 그대로 긁으면 푸터의 약관·저작권 문구 339자가 남고,
 * 그게 "본문"으로 넘어가 AI 가 유튜브 이용약관을 요약해버린다.
 *
 * 자막은 쓸 수 없다. 자막 목록은 HTML 에 들어 있지만 실제 자막 파일을
 * 요청하면 200 에 빈 응답이 온다 (서명 파라미터를 요구하도록 막혀 있다).
 *
 * 그래서 영상에 딸린 정보 — 제목, 채널, 길이, 태그, 설명란 — 만 모은다.
 * 영상을 본 것이 아니라는 점은 본문 머리에 적어 둔다.
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

function runtime(seconds: string | undefined): string | null {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return null;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export interface YoutubeDoc {
  title: string;
  content: string;
}

export async function fetchYoutube(id: string): Promise<YoutubeDoc> {
  const res = await fetch(`https://www.youtube.com/watch?v=${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SocialSummaryBot/1.0)' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`유튜브 페이지를 불러올 수 없습니다 (HTTP ${res.status})`);
  }

  const html = await res.text();
  const raw = sliceObject(html, '"videoDetails":');
  if (!raw) {
    throw new Error('영상 정보를 찾지 못했습니다. 비공개이거나 삭제된 영상일 수 있습니다.');
  }

  let details: VideoDetails;
  try {
    details = JSON.parse(raw) as VideoDetails;
  } catch {
    throw new Error('영상 정보를 읽지 못했습니다. 잠시 후 다시 시도해주세요.');
  }

  const title = (details.title || '').trim();
  const description = (details.shortDescription || '').trim();

  // 설명란이 거의 비어 있으면 요약할 거리가 없다.
  // 억지로 만들면 제목 한 줄을 부풀린 글이 나온다
  if (description.length < 80) {
    throw new Error(
      '이 영상은 설명란이 거의 비어 있어 요약할 내용이 없습니다. '
      + '영상 내용은 자막을 받아올 수 없어 읽지 못합니다.',
    );
  }

  const facts = [
    `제목: ${title}`,
    details.author ? `채널: ${details.author}` : null,
    runtime(details.lengthSeconds) ? `길이: ${runtime(details.lengthSeconds)}` : null,
    details.keywords?.length ? `태그: ${details.keywords.slice(0, 12).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const content = [
    '[이 자료는 유튜브 영상에 딸린 정보다. 영상을 본 것이 아니고 자막도 없다.',
    ' 아래 설명란에 적힌 내용까지만 쓸 수 있다. 영상에서 무엇을 보여주는지,',
    ' 어떤 장면이 나오는지 지어내지 마라.]',
    '',
    facts,
    '',
    '설명란:',
    description,
  ].join('\n').slice(0, 8000);

  return { title, content };
}
