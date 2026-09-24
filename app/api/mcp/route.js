import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const handler = createMcpHandler((server) => {
  server.tool(
    "get_allenamenti",
    "Restituisce gli ultimi allenamenti registrati",
    { limite: z.number().int().min(1).max(500).optional() },
    async ({ limite }) => {
      const n = limite || 100;
      const raw = await redis.lrange("allenamenti", -n, -1);
      const entries = raw.map((r) =>
        typeof r === "string" ? JSON.parse(r) : r
      );
      return {
        content: [{ type: "text", text: JSON.stringify(entries, null, 2) }],
      };
    }
  );

  server.tool(
    "add_allenamento",
    "Aggiunge un allenamento (esercizio, serie, ripetizioni, carico, note)",
    {
      esercizio: z.string(),
      serie: z.number().optional(),
      ripetizioni: z.number().optional(),
      carico_kg: z.number().optional(),
      note: z.string().optional(),
    },
    async (input) => {
      const entry = { ...input, timestamp: new Date().toISOString() };
      await redis.rpush("allenamenti", JSON.stringify(entry));
      return {
        content: [{ type: "text", text: `Salvato: ${JSON.stringify(entry)}` }],
      };
    }
  );
});

export { handler as GET, handler as POST, handler as DELETE };
