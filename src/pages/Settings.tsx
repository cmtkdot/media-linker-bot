import { MediaGroupSyncSection } from "@/components/settings/MediaGroupSyncSection";
import { ProcessFlowSection } from "@/components/settings/ProcessFlowSection";
import { MessageMediaSyncSection } from "@/components/settings/MessageMediaSyncSection";

export default function Settings() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      <div className="grid gap-8 md:grid-cols-2">
        <ProcessFlowSection />
        <MediaGroupSyncSection />
        <MessageMediaSyncSection />
      </div>
    </div>
  );
}