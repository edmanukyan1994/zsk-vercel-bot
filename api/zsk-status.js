import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  const inn = (req.query?.inn || "").toString();
  if (!/^\d{10,12}$/.test(inn)) {
    return res.status(400).json({ ok: false, error: "bad INN" });
  }

  // Пытаемся достать последний результат
  const latest = await redis.hgetall(`zsk:latest:${inn}`);
  if (latest && Object.keys(latest).length) {
    const updated = latest.updated_at
      ? new Date(Number(latest.updated_at) * 1000).toISOString()
      : null;
    return res.status(200).json({ ok: true, source: "latest", data: { ...latest, updated_at: updated } });
  }

  // fallback — берём кэш 24ч
  const cached = await redis.get(`zsk:cache:${inn}`);
  if (cached) {
    return res.status(200).json({
      ok: true,
      source: "cache",
      data: typeof cached === "string" ? JSON.parse(cached) : cached
    });
  }

  return res.status(200).json({ ok: true, data: null });
}
