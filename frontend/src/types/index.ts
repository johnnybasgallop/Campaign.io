export type CampaignStatus = {
  status: "running" | "complete" | "cancelled";
  total: number;
  sent: number;
  failed: number;
};

export type LogEntry = {
  event: string;
  level: string;
  message: string;
  timestamp: string;
};

export type PublishStatus = "idle" | "sending" | "sent" | "error";
