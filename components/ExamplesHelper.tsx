"use client";

import { useState } from "react";
import { EXAMPLES, type TabId } from "@/lib/examples";

interface Props {
  activeTab: TabId;
}

export default function ExamplesHelper({ activeTab }: Props) {
  const [copied, setCopied] = useState(false);
  const examples = EXAMPLES[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(examples.items.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group fixed bottom-20 right-6 z-40">
      {/* ? 아이콘 버튼 */}
      <button
        type="button"
        aria-label="시연용 예시 데이터 보기"
        className="w-11 h-11 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground text-lg font-bold hover:border-accent hover:text-accent transition-all"
      >
        ?
      </button>

      {/*
        호버 시 팝오버 — 버튼 위쪽으로 펼쳐짐.
        외곽 wrapper에 pb-2를 둬서 버튼-팝오버 사이 갭 영역도 hover 영역으로 포함.
      */}
      <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute bottom-full right-0 pb-2 transition-opacity duration-150">
        <div className="w-[340px] max-h-[70vh] overflow-y-auto bg-card rounded-lg shadow-2xl border border-border p-4">
          <div className="flex justify-between items-center mb-2 gap-2">
            <h3 className="text-sm font-bold text-foreground">{examples.title}</h3>
            <button
              type="button"
              onClick={handleCopy}
              className={`shrink-0 px-3 py-1 rounded text-xs font-semibold transition-all ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-accent text-white hover:bg-accent-hover"
              }`}
            >
              {copied ? "복사됨!" : "전체 복사"}
            </button>
          </div>
          <p className="text-xs text-muted mb-3">{examples.description}</p>
          <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-input-bg p-2.5 rounded text-foreground leading-relaxed max-h-[260px] overflow-y-auto">
            {examples.items.join("\n")}
          </pre>
        </div>
      </div>
    </div>
  );
}
