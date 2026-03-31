import { useAuth, RedirectToSignIn, UserButton } from "@clerk/react";
import { useEffect, useState } from "react";
import "./index.css";

const API = "http://localhost:8000";

function Dashboard() {
  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  useEffect(() => {
    fetch(`${API}/groups`)
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups);
        if (data.groups.length > 0) setSelectedGroup(data.groups[0]);
      });
  }, []);

  async function handlePublish() {
    if (!selectedGroup || !message.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch(`${API}/campaign/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group_name: selectedGroup, message: message.replace(/\/n/g, "\n") }),
      });
      if (!res.ok) throw new Error();
      setStatus("sent");
      setMessage("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-purple-100 px-8 py-4 flex items-center justify-between">
        <span className="text-purple-900 font-semibold text-lg tracking-tight">
          Campaign
        </span>
        <UserButton />
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">New Campaign</h1>
        <p className="text-gray-400 text-sm mb-10">
          Send a message to a Telegram group.
        </p>

        <div className="space-y-6">
          {/* Group select */}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
              Group
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full appearance-none rounded-xl border border-purple-300 bg-white pl-4 pr-10 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 transition bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22%3E%3Cpath fill=%22none%22 stroke=%22%236b21a8%22 stroke-width=%221.5%22 d=%22M1 1l5 5 5-5%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_1rem_center]"
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
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-widest mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              placeholder="Write your campaign message..."
              className="w-full rounded-xl border border-purple-300 bg-white px-4 py-3 text-gray-800 text-sm placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-600 transition resize-none"
            />
          </div>

          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={status === "sending" || !message.trim() || !selectedGroup}
            className="w-full rounded-xl bg-purple-800 hover:bg-purple-900 disabled:bg-gray-300 text-white font-semibold py-3 text-sm transition"
          >
            {status === "sending"
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

  if (!isLoaded) return null;
  if (!isSignedIn) return <RedirectToSignIn />;

  return <Dashboard />;
}

export default App;
