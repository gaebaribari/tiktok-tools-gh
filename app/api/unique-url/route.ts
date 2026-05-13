import { NextRequest } from "next/server";
import { extractUsernames, fetchUniqueUrl, type UniqueUrlResult } from "@/lib/tiktok";

interface UniqueUrlEvent {
  type: "result" | "error" | "done";
  username?: string;
  result?: UniqueUrlResult;
  total?: number;
  completed?: number;
}

export async function POST(req: NextRequest) {
  const { urls } = (await req.json()) as { urls: string[] };

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return new Response(JSON.stringify({ error: "urls 배열이 필요합니다" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const usernames = extractUsernames(urls);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: UniqueUrlEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      const CONCURRENCY = 3;
      let completed = 0;

      for (let i = 0; i < usernames.length; i += CONCURRENCY) {
        const batch = usernames.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map((u) => fetchUniqueUrl(u).catch(() => null)));

        for (let j = 0; j < batch.length; j++) {
          completed++;
          const result = results[j];
          if (result) {
            send({ type: "result", username: batch[j], result, total: usernames.length, completed });
          } else {
            send({ type: "error", username: batch[j], total: usernames.length, completed });
          }
        }
      }

      send({ type: "done", total: usernames.length, completed });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
