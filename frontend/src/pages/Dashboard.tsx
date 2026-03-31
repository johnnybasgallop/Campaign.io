import { useEffect, useState } from "react";
import { fetchCampaignStatus, fetchGroups, startCampaign } from "../api";
import { CampaignForm } from "../components/CampaignForm";
import { Header } from "../components/Header";
import { ProgressCard } from "../components/ProgressCard";
import { useDarkMode } from "../hooks/useDarkMode";
import type { PublishStatus } from "../types";

export function Dashboard() {
  const { dark, toggleDark } = useDarkMode();

  const [groups, setGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [message, setMessage] = useState("");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignRunning, setCampaignRunning] = useState(false);

  // Load available groups on mount
  useEffect(() => {
    fetchGroups().then((data) => {
      setGroups(data);
      if (data.length > 0) setSelectedGroup(data[0]);
    });
  }, []);

  // Restore an active campaign from a previous session
  useEffect(() => {
    const saved = localStorage.getItem("activeCampaignId");
    if (!saved) return;

    fetchCampaignStatus(saved)
      .then((data) => {
        setCampaignId(saved);
        if (data.status === "running") setCampaignRunning(true);
      })
      .catch(() => localStorage.removeItem("activeCampaignId"));
  }, []);

  // Keep localStorage in sync so refreshes can restore state
  useEffect(() => {
    if (campaignId) localStorage.setItem("activeCampaignId", campaignId);
    else localStorage.removeItem("activeCampaignId");
  }, [campaignId]);

  async function handlePublish() {
    if (!selectedGroup || !message.trim()) return;

    setPublishStatus("sending");
    setCampaignId(null);

    try {
      // Replace /n shorthand with real newlines before sending
      const formatted = message.replace(/\/n/g, "\n");
      const data = await startCampaign(selectedGroup, formatted);
      setCampaignId(data.campaign_id);
      setCampaignRunning(true);
      setPublishStatus("sent");
      setMessage("");
      setTimeout(() => setPublishStatus("idle"), 3000);
    } catch {
      setPublishStatus("error");
      setTimeout(() => setPublishStatus("idle"), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200">
      <Header dark={dark} onToggleDark={toggleDark} />

      <main className="max-w-2xl mx-auto px-6 pt-20 pb-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
          New Campaign
        </h1>
        <p className="text-gray-400 dark:text-gray-500 text-sm mb-10">
          Send a message to a Telegram group.
        </p>

        {campaignId && (
          <ProgressCard
            campaignId={campaignId}
            onFinished={() => setCampaignRunning(false)}
          />
        )}

        <CampaignForm
          groups={groups}
          selectedGroup={selectedGroup}
          onGroupChange={setSelectedGroup}
          message={message}
          onMessageChange={setMessage}
          onPublish={handlePublish}
          publishStatus={publishStatus}
          campaignRunning={campaignRunning}
        />
      </main>
    </div>
  );
}
