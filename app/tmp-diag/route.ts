// 진단용 임시 라우트 — 원인 확인 후 바로 지운다
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('v') || '19Gmsq6Bw2k';
  const ua = new URL(req.url).searchParams.get('ua') === 'browser'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    : 'Mozilla/5.0 (compatible; SocialSummaryBot/1.0)';
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${id}`, {
      headers: { 'User-Agent': ua, 'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const i = html.indexOf('shortDescription');
    return Response.json({
      status: res.status,
      ua: ua.slice(0, 40),
      htmlLen: html.length,
      hasVideoDetails: html.includes('videoDetails'),
      hasShortDescription: i >= 0,
      consent: /consent\.youtube|사용자 지정 없이|Before you continue/.test(html),
      captcha: /captcha|unusual traffic|automated queries/i.test(html),
      around: i >= 0 ? html.slice(i, i + 300) : html.slice(0, 300),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message });
  }
}
