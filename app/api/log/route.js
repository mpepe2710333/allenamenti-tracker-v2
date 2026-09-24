import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
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
