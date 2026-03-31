import { useEffect, useState } from "react";
import { openLogsStream } from "../api";
import type { LogEntry } from "../types";

export function useCampaignLogs(campaignId: string | null) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);

  useEffect(() => {
    if (!campaignId) return;

    const es = openLogsStream(campaignId);
    es.onmessage = (e) => {
      const entry: LogEntry = JSON.parse(e.data);
      setLogs((prev) => [...prev, entry]);
    };
    es.onerror = () => es.close();

    return () => es.close();
  }, [campaignId]);

  return { logs, showLogs, setShowLogs };
}
