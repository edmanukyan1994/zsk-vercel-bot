import { Redis } from "@upstash/redis";
export const config = { runtime: "edge" };

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler() {
  const suppliers = await redis.smembers("zsk:suppliers");
  if (!suppliers?.length) {
    return new Response(JSON.stringify({ ok: true, queued: 0 }), { status: 200 });
  }

  const now = Math.floor(Date.now() / 1000);
  let queued = 0;
  for (const inn of suppliers) {
    const latest = await redis.hgetall(`zsk:latest:${inn}`);
    const ts = latest?.updated_at ? Number(latest.updated_at) : 0;
    if (now - ts < 20 * 3600) continue; // свежее 20ч — пропустим
    await redis.rpush("zsk:queue", JSON.stringify({ inn, chat_id: 0 }));
    queued++;
  }

  return new Response(
    JSON.stringify({ ok: true, suppliers: suppliers.length, queued }),
    { status: 200 }
  );
}
