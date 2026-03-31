import type { PublishStatus } from "../types";

// Inline SVG caret for the select dropdown
const SELECT_CARET =
  "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22%3E%3Cpath fill=%22none%22 stroke=%22%236b21a8%22 stroke-width=%221.5%22 d=%22M1 1l5 5 5-5%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_1rem_center]";

type Props = {
  groups: string[];
  selectedGroup: string;
  onGroupChange: (group: string) => void;
  message: string;
  onMessageChange: (message: string) => void;
  onPublish: () => void;
  publishStatus: PublishStatus;
  campaignRunning: boolean;
};

function publishButtonLabel(status: PublishStatus, running: boolean): string {
  if (running) return "Campaign in progress...";
  if (status === "sending") return "Sending...";
  if (status === "sent") return "Sent!";
  if (status === "error") return "Failed — try again";
  return "Publish";
}

export function CampaignForm({
  groups,
  selectedGroup,
  onGroupChange,
  message,
  onMessageChange,
  onPublish,
  publishStatus,
  campaignRunning,
}: Props) {
  const isDisabled =
    campaignRunning ||
    publishStatus === "sending" ||
    !message.trim() ||
    !selectedGroup;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
          Group
        </label>
        <select
          value={selectedGroup}
          onChange={(e) => onGroupChange(e.target.value)}
          className={`w-full appearance-none rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800 pl-4 pr-10 py-3 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 transition ${SELECT_CARET}`}
        >
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          rows={6}
          placeholder="Write your campaign message..."
          className="w-full rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-800 dark:text-gray-200 text-sm placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600 transition resize-none"
        />
      </div>

      <button
        onClick={onPublish}
        disabled={isDisabled}
        className="w-full rounded-xl bg-purple-800 hover:bg-purple-900 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition"
      >
        {publishButtonLabel(publishStatus, campaignRunning)}
      </button>
    </div>
  );
}
