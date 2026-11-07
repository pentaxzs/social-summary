// 진단용 임시 라우트 — 원인 확인 후 바로 지운다
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('v') || '19Gmsq6Bw2k';
  const out: Record<string, unknown> = {};

  try {
    const r = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
      { signal: AbortSignal.timeout(10000) },
    );
    out.oembed = { status: r.status, body: (await r.text()).slice(0, 240) };
  } catch (e) { out.oembed = { error: (e as Error).message }; }

  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=DUMMY_KEY_FOR_REACHABILITY`,
      { signal: AbortSignal.timeout(10000) },
    );
    out.dataApi = { status: r.status, body: (await r.text()).slice(0, 300) };
  } catch (e) { out.dataApi = { error: (e as Error).message }; }

  return Response.json(out);
}
