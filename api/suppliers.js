import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function normalizeInns(body) {
  const inns = [];
  if (body?.inn) inns.push(String(body.inn));
  if (Array.isArray(body?.inns)) inns.push(...body.inns.map(String));
  // валидируем 10–12 цифр
  const valid = inns
    .map(x => x.replace(/\s+/g, ""))
    .filter(x => /^\d{10,12}$/.test(x));
  // уникальные
  return Array.from(new Set(valid));
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const list = await redis.smembers("zsk:suppliers");
      return res.status(200).json({ ok: true, suppliers: list });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const inns = normalizeInns(body);
      if (!inns.length) {
        return res.status(400).json({ ok: false, error: "no valid INN(s)" });
      }

      // добавляем в набор мониторинга
      let added = 0;
      if (inns.length === 1) {
        added = (await redis.sadd("zsk:suppliers", inns[0])) ? 1 : 0;
      } else {
        // sadd принимает varargs
        added = await redis.sadd("zsk:suppliers", ...inns);
      }

      // опциональная мгновенная проверка: ?enqueue=1
      let enqueued = 0;
      if (String(req.query?.enqueue || "0") === "1") {
        // rpush тоже varargs
        const tasks = inns.map(inn => JSON.stringify({ inn }));
        if (tasks.length === 1) {
          await redis.rpush("zsk:queue", tasks[0]);
          enqueued = 1;
        } else if (tasks.length > 1) {
          await redis.rpush("zsk:queue", ...tasks);
          enqueued = tasks.length;
        }
      }

      return res.status(200).json({ ok: true, added, enqueued, inns });
    }

    if (req.method === "DELETE") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const inns = normalizeInns(body);
      if (!inns.length) {
        return res.status(400).json({ ok: false, error: "no valid INN(s)" });
      }
      let removed = 0;
      if (inns.length === 1) {
        removed = await redis.srem("zsk:suppliers", inns[0]);
      } else {
        removed = await redis.srem("zsk:suppliers", ...inns);
      }
      return res.status(200).json({ ok: true, removed, inns });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
