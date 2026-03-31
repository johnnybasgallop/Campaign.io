import { cancelCampaign } from "../api";
import { BATCH_PAUSE, BATCH_SIZE, AVG_MSG_DELAY } from "../constants";
import { useCampaignLogs } from "../hooks/useCampaignLogs";
import { useCampaignStatus } from "../hooks/useCampaignStatus";
import { LogPanel } from "./LogPanel";

type Props = {
  campaignId: string;
  onFinished: () => void;
};

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

export function ProgressCard({ campaignId, onFinished }: Props) {
  const data = useCampaignStatus(campaignId, onFinished);
  const { logs, showLogs, setShowLogs } = useCampaignLogs(campaignId);

  if (!data) return null;

  const processed = data.sent + data.failed;
  const remaining = data.total - processed;
  const pct = data.total > 0 ? Math.round((processed / data.total) * 100) : 0;
  const isRunning = data.status === "running";
  const isComplete = data.status === "complete";
  const isCancelled = data.status === "cancelled";

  // Estimate based on avg delay per message plus expected batch pauses
  const estimatedSeconds =
    remaining * AVG_MSG_DELAY + Math.floor(remaining / BATCH_SIZE) * BATCH_PAUSE;

  const statusBadgeClass = isCancelled
    ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";

  const progressBarClass = isCancelled
    ? "bg-red-400"
    : "bg-purple-800 dark:bg-purple-500";

  return (
    <div className="rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/10 p-6 mb-10">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">
          Campaign Progress
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusBadgeClass}`}>
            {isComplete ? "Complete" : isCancelled ? "Cancelled" : "Running"}
          </span>
          {isRunning && (
            <button
              onClick={() => cancelCampaign(campaignId)}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-2 mb-5">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${progressBarClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.total}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Total</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-400">{data.sent}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Sent</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-red-400">{data.failed}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Failed</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
        {isComplete
          ? `${data.sent} sent, ${data.failed} failed`
          : isCancelled
          ? `Cancelled after ${data.sent} sent, ${data.failed} failed`
          : `${pct}% complete · Est. ${formatTimeRemaining(estimatedSeconds)} remaining`}
      </p>

      <LogPanel
        logs={logs}
        show={showLogs}
        onToggle={() => setShowLogs((v) => !v)}
      />
    </div>
  );
}
