import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const BOT_TOKEN = process.env.BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("ok");

  const update = req.body;
  const msg = update?.message;
  if (!msg) return res.status(200).json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text || "";

  const m = text.match(/^\/check\s+(\d{10,12})/);
  if (!m) {
    await send(chatId, "Используйте: /check 7701234567");
    return res.status(200).json({ ok: true });
  }

  const inn = m[1];

  // кэш
  const cached = await redis.get(`zsk:cache:${inn}`);
  if (cached) {
    const data = typeof cached === "string" ? JSON.parse(cached) : cached;
    await send(
      chatId,
      `ИНН: ${inn}\nРезультат (кэш): ${data.risk}\n\n${
        data.explanation || data.raw?.slice(0, 1000) || ""
      }`
    );
    return res.status(200).json({ ok: true });
  }

  // задача в очередь для воркера
  await redis.rpush("zsk:queue", JSON.stringify({ inn, chat_id: chatId }));
  await send(chatId, "Принял запрос. Подождите…");
  return res.status(200).json({ ok: true });
}

async function send(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
}
