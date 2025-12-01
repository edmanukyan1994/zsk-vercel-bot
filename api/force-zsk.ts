import { Redis } from "@upstash/redis";

export const config = { runtime: "edge" };

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // 1) Берём всех поставщиков (ИНН) из множества
    const suppliers = await redis.smembers<string>("zsk:suppliers");

    if (!suppliers || !suppliers.length) {
      return new Response(
        JSON.stringify({ ok: true, suppliers: 0, queued: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let queued = 0;

    // 2) Кладём КАЖДЫЙ ИНН в очередь на проверку
    for (const inn of suppliers) {
      if (!inn) continue;

      await redis.rpush(
        "zsk:queue",
        JSON.stringify({ inn: String(inn), chat_id: 0 }) // тихий режим
      );
      queued++;
    }

    // 3) Отчитываемся
    return new Response(
      JSON.stringify({
        ok: true,
        suppliers: suppliers.length,
        queued
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e?.message || e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
