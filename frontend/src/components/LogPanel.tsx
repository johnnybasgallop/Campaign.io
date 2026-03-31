import { useEffect, useRef } from "react";
import type { LogEntry } from "../types";

type Props = {
  logs: LogEntry[];
  show: boolean;
  onToggle: () => void;
};

function logColor(log: LogEntry): string {
  if (log.level === "error") return "text-red-400";
  if (log.level === "warning") return "text-yellow-400";
  if (log.event === "sent") return "text-green-400";
  if (log.event === "complete" || log.event === "cancelled")
    return "text-purple-400";
  return "text-gray-400";
}

export function LogPanel({ logs, show, onToggle }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Scroll to the latest log entry whenever logs update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="mt-5">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition mb-2"
      >
        <span>{show ? "▾" : "▸"}</span>
        <span>{show ? "Hide" : "Show"} logs</span>
      </button>

      {show && (
        <div className="rounded-xl bg-gray-950 p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
          {logs.map((log, i) => (
            <div key={i} className={`leading-relaxed ${logColor(log)}`}>
              <span className="text-gray-600 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
