import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function colorForRisk(risk) {
  switch (risk) {
    case "high": return "red";
    case "medium": return "orange";
    case "low":
    case "none": return "green";
    case "unknown":
    default: return "gray";
  }
}

export default async function handler(req, res) {
  const inn = (req.query?.inn || "").toString();
  const autostart = String(req.query?.autostart || "0") === "1";
  if (!/^\d{10,12}$/.test(inn)) {
    return res.status(400).json({ ok: false, error: "bad INN" });
  }

  // 1) свежие данные
  const latest = await redis.hgetall(`zsk:latest:${inn}`);
  if (latest && Object.keys(latest).length) {
    const risk = latest.risk || "unknown";
    const risk_color = colorForRisk(risk);
    const updated_at = latest.updated_at
      ? new Date(Number(latest.updated_at) * 1000).toISOString()
      : null;

    return res.status(200).json({
      ok: true,
      source: "latest",
      pending: false,
      data: { ...latest, updated_at, risk_color },
    });
  }

  // 2) fallback — кэш 24ч
  const cached = await redis.get(`zsk:cache:${inn}`);
  if (cached) {
    const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
    const risk = parsed.risk || "unknown";
    const risk_color = colorForRisk(risk);
    return res.status(200).json({
      ok: true,
      source: "cache",
      pending: false,
      data: { ...parsed, risk_color },
    });
  }

  // 3) ничего нет — при необходимости ставим задачу в очередь для воркера (без chat_id)
  if (autostart) {
    await redis.rpush("zsk:queue", JSON.stringify({ inn }));
  }

  // отдаём нейтральный статус, фронт покажет серый
  return res.status(200).json({
    ok: true,
    pending: autostart, // фронт поймёт, что идёт первичная проверка
    data: { risk: "unknown", risk_color: "gray" },
  });
}
