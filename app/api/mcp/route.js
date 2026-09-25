import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const TOOLS = [
  {
    name: "get_allenamenti",
    description: "Restituisce gli allenamenti registrati, dal piu vecchio al piu recente.",
    inputSchema: {
      type: "object",
      properties: {
        limite: { type: "number", description: "Quanti allenamenti restituire (default 100, max 500)" },
      },
    },
  },
  {
    name: "add_allenamento",
    description: "Registra un nuovo allenamento.",
    inputSchema: {
      type: "object",
      properties: {
        esercizio: { type: "string" },
        serie: { type: "number" },
        ripetizioni: { type: "number" },
        carico_kg: { type: "number" },
        note: { type: "string" },
      },
      required: ["esercizio"],
    },
  },
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function callTool(name, args = {}) {
  if (name === "get_allenamenti") {
    const n = Math.min(Math.max(parseInt(args.limite) || 100, 1), 500);
    const raw = await redis.lrange("allenamenti", -n, -1);
    const entries = raw.map((r) => {
      if (typeof r !== "string") return r;
      try { return JSON.parse(r); } catch { return r; }
    });
    return entries.length ? JSON.stringify(entries, null, 2) : "Nessun allenamento registrato.";
  }
  if (name === "add_allenamento") {
    if (!args.esercizio) throw new Error("Il campo esercizio e obbligatorio");
    const entry = { ...args, timestamp: new Date().toISOString() };
    await redis.rpush("allenamenti", JSON.stringify(entry));
    return "Salvato: " + JSON.stringify(entry);
  }
  throw new Error("Strumento sconosciuto: " + name);
}

async function handle(msg) {
  const { id, method, params } = msg || {};
  const isNotification = id === undefined || id === null;
  try {
    let result;
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: (params && params.protocolVersion) || "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "allenamenti-tracker", version: "1.0.0" },
        };
        break;
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = { tools: TOOLS };
        break;
      case "tools/call":
        try {
          const text = await callTool(params && params.name, (params && params.arguments) || {});
          result = { content: [{ type: "text", text }] };
        } catch (e) {
          result = { content: [{ type: "text", text: "Errore: " + e.message }], isError: true };
        }
        break;
      case "resources/list":
        result = { resources: [] };
        break;
      case "prompts/list":
        result = { prompts: [] };
        break;
      default:
        if (isNotification) return null;
        return { jsonrpc: "2.0", id, error: { code: -32601, message: "Metodo non supportato: " + method } };
    }
    return isNotification ? null : { jsonrpc: "2.0", id, result };
  } catch (e) {
    return isNotification ? null : { jsonrpc: "2.0", id, error: { code: -32603, message: String(e) } };
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const res = await handle(body);
  return res ? json(res) : new Response(null, { status: 202, headers: CORS });
}

export async function GET() {
  return new Response(JSON.stringify({ status: "Server MCP attivo. Claude usa POST." }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: "POST", ...CORS },
  });
}

export async function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: "POST", ...CORS } });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
