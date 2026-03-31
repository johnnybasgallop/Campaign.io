import { useAuth, RedirectToSignIn, UserButton } from "@clerk/react";
import { useEffect, useRef, useState } from "react";
import { MdScheduleSend } from "react-icons/md";
import { BsMoonFill, BsSunFill } from "react-icons/bs";

import "./index.css";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type CampaignStatus = {
  status: "running" | "complete" | "cancelled";
  total: number;
  sent: number;
  failed: number;
};

const BATCH_SIZE = 50;
const BATCH_PAUSE = 60;
const AVG_MSG_DELAY = 5.5;

function formatTime(seconds: number): string {
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `~${m}m ${s}s` : `~${m}m`;
}

type LogEntry = {
  event: string;
  level: string;
  message: string;
  timestamp: string;
};

function ProgressCard({ campaignId, onFinished }: { campaignId: string; onFinished: () => void }) {
  const [data, setData] = useState<CampaignStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const poll = async () => {
      const res = await fetch(`${API}/campaign/${campaignId}/status`);
      if (!res.ok) return;
      const json: CampaignStatus = await res.json();
      setData(json);
      if (json.status !== "running" && intervalRef.current) {
        clearInterval(intervalRef.current);
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

  useEffect(() => {
    const es = new EventSource(`${API}/campaign/${campaignId}/logs`);
    es.onmessage = (e) => {
      const entry: LogEntry = JSON.parse(e.data);
      setLogs((prev) => [...prev, entry]);
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [campaignId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (!data) return null;

  const processed = data.sent + data.failed;
  const remaining = data.total - processed;
  const pct = data.total > 0 ? Math.round((processed / data.total) * 100) : 0;
  const isRunning = data.status === "running";
  const isComplete = data.status === "complete";
  const isCancelled = data.status === "cancelled";

  const batchPausesRemaining = Math.floor(remaining / BATCH_SIZE) * BATCH_PAUSE;
  const estimatedSeconds = remaining * AVG_MSG_DELAY + batchPausesRemaining;

  async function handleCancel() {
    await fetch(`${API}/campaign/${campaignId}/cancel`, { method: "POST" });
  }

  return (
    <div className="rounded-2xl border border-purple-100 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/10 p-6 mb-10">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">
          Campaign Progress
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              isComplete
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : isCancelled
                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            }`}
          >
            {isComplete ? "Complete" : isCancelled ? "Cancelled" : "Running"}
          </span>
          {isRunning && (
            <button
              onClick={handleCancel}
              className="text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-2 mb-5">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${isCancelled ? "bg-red-400" : "bg-purple-800 dark:bg-purple-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stats */}
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
          : `${pct}% complete · Est. ${formatTime(estimatedSeconds)} remaining`}
      </p>

      {/* Log panel */}
      {logs.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition mb-2"
          >
            <span>{showLogs ? "▾" : "▸"}</span>
            <span>{showLogs ? "Hide" : "Show"} logs</span>
          </button>
        </div>
      )}
      {logs.length > 0 && showLogs && (
        <div className="rounded-xl bg-gray-950 p-4 h-48 overflow-y-auto font-mono text-xs space-y-1">
          {logs.map((log, i) => (
            <div
              key={i}
              className={`leading-relaxed ${
                log.level === "error"
                  ? "text-red-400"
                  : log.level === "warning"
                  ? "text-yellow-400"
                  : log.event === "sent"
                  ? "text-green-400"
                  : log.event === "complete" || log.event === "cancelled"
                  ? "text-purple-400"
                  : "text-gray-400"
              }`}
            >
              <span className="text-gray-600 mr-2">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}
    </div>
  );
}

function Dashboard({ dark, toggleDark }: { dark: boolean; toggleDark: () => void }) {
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignRunning, setCampaignRunning] = useState(false);

  useEffect(() => {
    fetch(`${API}/groups`)
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups);
        if (data.groups.length > 0) setSelectedGroup(data.groups[0]);
      });
  }, []);

  // Restore active campaign from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("activeCampaignId");
    if (!saved) return;
    fetch(`${API}/campaign/${saved}/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setCampaignId(saved);
          if (data.status === "running") setCampaignRunning(true);
        } else {
          localStorage.removeItem("activeCampaignId");
        }
      })
      .catch(() => localStorage.removeItem("activeCampaignId"));
  }, []);

  // Keep localStorage in sync with campaignId
  useEffect(() => {
    if (campaignId) localStorage.setItem("activeCampaignId", campaignId);
    else localStorage.removeItem("activeCampaignId");
  }, [campaignId]);

  async function handlePublish() {
    if (!selectedGroup || !message.trim()) return;
    setStatus("sending");
    setCampaignId(null);
    try {
      const res = await fetch(`${API}/campaign/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_name: selectedGroup,
          message: message.replace(/\/n/g, "\n"),
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCampaignId(data.campaign_id);
      setCampaignRunning(true);
      setStatus("sent");
      setMessage("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-purple-100 dark:border-purple-900/40 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <MdScheduleSend className="text-purple-800 dark:text-purple-400 text-2xl" />
          <span className="text-gray-900 dark:text-white font-bold text-lg tracking-tight">
            DMOCampaigns
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleDark}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            aria-label="Toggle dark mode"
          >
            {dark ? <BsSunFill className="text-base" /> : <BsMoonFill className="text-base" />}
          </button>
          <UserButton />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">New Campaign</h1>
        <p className="text-gray-400 dark:text-gray-500 text-sm mb-10">
          Send a message to a Telegram group.
        </p>

        {/* Progress tracker */}
        {campaignId && <ProgressCard campaignId={campaignId} onFinished={() => setCampaignRunning(false)} />}

        <div className="space-y-6">
          {/* Group select */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
              Group
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full appearance-none rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800 pl-4 pr-10 py-3 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 transition bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22%3E%3Cpath fill=%22none%22 stroke=%22%236b21a8%22 stroke-width=%221.5%22 d=%22M1 1l5 5 5-5%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_1rem_center]"
            >
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Write your campaign message..."
              className="w-full rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-800 dark:text-gray-200 text-sm placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-600 transition resize-none"
            />
          </div>

          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={status === "sending" || !message.trim() || !selectedGroup || campaignRunning}
            className="w-full rounded-xl bg-purple-800 hover:bg-purple-900 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition"
          >
            {campaignRunning
              ? "Campaign in progress..."
              : status === "sending"
              ? "Sending..."
              : status === "sent"
              ? "Sent!"
              : status === "error"
              ? "Failed — try again"
              : "Publish"}
          </button>
        </div>
      </main>
    </div>
  );
}

function App() {
  const { isSignedIn, isLoaded } = useAuth();
  const [dark, setDark] = useState(false);

  function toggleDark() {
    setDark((v) => {
      document.documentElement.classList.toggle("dark", !v);
      return !v;
    });
  }

  if (!isLoaded) return null;
  if (!isSignedIn) return <RedirectToSignIn />;

  return <Dashboard dark={dark} toggleDark={toggleDark} />;
}

export default App;
