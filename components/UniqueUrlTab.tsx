"use client";

import { useState, useCallback } from "react";
import type { UniqueUrlResult } from "@/lib/tiktok";

export default function UniqueUrlTab() {
  const [urlText, setUrlText] = useState("");
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<UniqueUrlResult[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleExtract = useCallback(async () => {
    const urls = urlText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (urls.length === 0) return;

    setLoading(true);
    setResults([]);
    setFailed([]);
    setTotal(urls.length);

    try {
      const res = await fetch("/api/unique-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          for (const dataLine of part.split("\n").filter((l) => l.startsWith("data: "))) {
            const dataStr = dataLine.slice(6).trim();
            if (!dataStr) continue;
            try {
              const event = JSON.parse(dataStr);
              if (event.type === "result" && event.result) {
                if (event.total) setTotal(event.total);
                setResults((prev) => [...prev, event.result]);
              } else if (event.type === "error") {
                if (event.total) setTotal(event.total);
                setFailed((prev) => [...prev, `https://www.tiktok.com/@${event.username}`]);
              }
            } catch { /* ignore */ }
          }
        }
      }
      setUrlText("");
    } catch {
      alert("변환 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }, [urlText]);

  const handleCopyAll = useCallback(() => {
    if (results.length === 0) return;
    const text = results.map((r) => r.uniqueUrl).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [results]);

  const progressPct = total > 0 ? Math.round(((results.length + failed.length) / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-foreground">
          TikTok URL 입력
        </label>
        <textarea
          value={urlText}
          onChange={(e) => setUrlText(e.target.value)}
          placeholder="틱톡 URL을 한 줄에 하나씩 붙여넣기"
          rows={6}
          className="w-full resize-y font-mono"
        />
        <div className="text-xs text-muted mt-2 space-y-0.5">
          <p>핸들이 바뀌어도 변하지 않는 숫자ID 기반 고유주소를 추출합니다.</p>
          <p>ex) https://www.tiktok.com/@username → https://www.tiktok.com/@1234567890</p>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleExtract}
            disabled={loading || !urlText.trim()}
            className="px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-semibold hover:bg-accent-hover disabled:bg-accent-light disabled:cursor-not-allowed transition-all"
          >
            {loading ? "변환 중..." : "고유주소 추출"}
          </button>
          {urlText.trim() && !loading && (
            <button
              onClick={() => setUrlText("")}
              className="px-4 py-2.5 bg-btn-gray text-foreground rounded-lg text-sm font-semibold hover:bg-btn-gray-hover transition-all"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {(loading || total > 0) && (
        <div className="space-y-2">
          <div className="w-full h-2 bg-input-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-sm text-muted text-center">
            {results.length + failed.length} / {total}
            {failed.length > 0 && ` · 실패 ${failed.length}`}
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">결과 {results.length}건</h3>
            <button
              onClick={handleCopyAll}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                copiedAll
                  ? "bg-green-500 text-white"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {copiedAll ? "복사 완료!" : "고유주소 전체 복사"}
            </button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-input-bg">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold w-1/3">입력 핸들</th>
                  <th className="px-3 py-2 text-left font-semibold">고유주소</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.username} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">@{r.username}</td>
                    <td className="px-3 py-2 font-mono">
                      <a
                        href={r.uniqueUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline break-all"
                      >
                        {r.uniqueUrl}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {failed.length > 0 && !loading && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">실패 {failed.length}건</h3>
          <textarea
            readOnly
            value={failed.join("\n")}
            className="w-full h-28 font-mono bg-input-bg resize-none"
            onFocus={(e) => e.target.select()}
          />
        </div>
      )}
    </div>
  );
}
