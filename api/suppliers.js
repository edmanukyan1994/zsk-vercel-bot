import { Redis } from "@upstash/redis";
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  if (req.method === "GET") {
    const list = await redis.smembers("zsk:suppliers");
    return res.status(200).json({ ok: true, suppliers: list });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const inns = Array.isArray(body?.inns) ? body.inns : [];
    const valid = inns.filter(x => /^\d{10,12}$/.test(String(x)));
    if (!valid.length)
      return res.status(400).json({ ok: false, error: "no valid inns" });
    await redis.sadd("zsk:suppliers", ...valid);
    return res.status(200).json({ ok: true, added: valid.length });
  }

  if (req.method === "DELETE") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const inns = Array.isArray(body?.inns) ? body.inns : [];
    const valid = inns.filter(x => /^\d{10,12}$/.test(String(x)));
    if (!valid.length)
      return res.status(400).json({ ok: false, error: "no valid inns" });
    await redis.srem("zsk:suppliers", ...valid);
    return res.status(200).json({ ok: true, removed: valid.length });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
