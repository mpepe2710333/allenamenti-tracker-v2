import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const entry = { ...body, timestamp: new Date().toISOString() };
    await redis.rpush("allenamenti", JSON.stringify(entry));
    return Response.json({ ok: true, saved: entry });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ status: "ok, usa POST per salvare un allenamento" });
}
