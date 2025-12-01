import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler() {
  try {
    const suppliers = await redis.smembers("zsk:suppliers");

    if (!suppliers || suppliers.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "no suppliers" }), { status: 200 });
    }

    let queued = 0;

    for (const inn of suppliers) {
      await redis.rpush("zsk:queue", JSON.stringify({ inn, chat_id: 0 }));
      queued++;
    }

    return new Response(
      JSON.stringify({ ok: true, suppliers: suppliers.length, queued }),
      { status: 200 }
    );

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.toString() }), { status: 500 });
  }
}
