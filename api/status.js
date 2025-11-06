import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const inn = (req.query?.inn || "").toString();
  if (!/^\d{10,12}$/.test(inn)) {
    return res.status(400).json({ ok: false, error: "bad INN" });
  }

  // Сначала смотрим свежие данные (воркер кладёт сюда)
  const latest = await redis.hgetall(`zsk:latest:${inn}`);
  if (latest && Object.keys(latest).length) {
    const updated_at = latest.updated_at
      ? new Date(Number(latest.updated_at) * 1000).toISOString()
      : null;
    return res.status(200).json({ ok: true, found: true, data: { ...latest, updated_at } });
  }

  // Фоллбек — кэш на 24ч (если вдруг пригодится)
  const cached = await redis.get(`zsk:cache:${inn}`);
  if (cached) {
    const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
    return res.status(200).json({ ok: true, found: true, data: parsed });
  }

  // Пока ничего нет — ждём, пока воркер запишет
  return res.status(200).json({ ok: true, found: false });
}
