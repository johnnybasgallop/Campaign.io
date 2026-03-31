import type { CampaignStatus } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function fetchGroups(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/groups`);
  if (!res.ok) throw new Error("Failed to fetch groups");
  const data = await res.json();
  return data.groups;
}

export async function startCampaign(
  groupName: string,
  message: string,
): Promise<{ campaign_id: string; recipients: number }> {
  const res = await fetch(`${BASE_URL}/campaign/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_name: groupName, message }),
  });
  if (!res.ok) throw new Error("Failed to start campaign");
  return res.json();
}

export async function fetchCampaignStatus(
  campaignId: string,
): Promise<CampaignStatus> {
  const res = await fetch(`${BASE_URL}/campaign/${campaignId}/status`);
  if (!res.ok) throw new Error("Campaign not found");
  return res.json();
}

export async function cancelCampaign(campaignId: string): Promise<void> {
  await fetch(`${BASE_URL}/campaign/${campaignId}/cancel`, { method: "POST" });
}

export function openLogsStream(campaignId: string): EventSource {
  return new EventSource(`${BASE_URL}/campaign/${campaignId}/logs`);
}
