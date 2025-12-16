import { Redis } from "@upstash/redis";
export const config = { runtime: "edge" };

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler() {
  const suppliers = await redis.smembers("zsk:suppliers");

  if (!suppliers || suppliers.length === 0) {
    return new Response(JSON.stringify({ ok: true, suppliers: 0, queued: 0 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const now = Math.floor(Date.now() / 1000);
  let queued = 0;

  for (const inn of suppliers) {
    // каждый день в 8:00 МСК — ВСЕГДА форсим обновление
    await redis.rpush(
      "zsk:queue",
      JSON.stringify({ inn: String(inn), chat_id: 0, force: 1, source: "cron", enqueued_at: now })
    );
    queued++;
  }

  return new Response(
    JSON.stringify({ ok: true, suppliers: suppliers.length, queued }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
