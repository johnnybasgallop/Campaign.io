import { useEffect, useRef, useState } from "react";
import { fetchCampaignStatus } from "../api";
import type { CampaignStatus } from "../types";

export function useCampaignStatus(
  campaignId: string | null,
  onFinished: () => void,
) {
  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!campaignId) return;

    const poll = async () => {
      try {
        const data = await fetchCampaignStatus(campaignId);
        setStatus(data);

        if (data.status !== "running") {
          clearInterval(intervalRef.current!);
          localStorage.removeItem("activeCampaignId");
          onFinished();
        }
      } catch {
        // Campaign no longer exists (e.g. server restarted) — clear and stop
        clearInterval(intervalRef.current!);
        localStorage.removeItem("activeCampaignId");
        onFinished();
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [campaignId]);

  return status;
}
