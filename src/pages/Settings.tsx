import { ThumbnailSection } from "@/components/settings/ThumbnailSection";
import { CaptionSyncSection } from "@/components/settings/CaptionSyncSection";
import { GlideSyncSection } from "@/components/settings/GlideSyncSection";

const Settings = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="grid gap-6">
        <ThumbnailSection />
        <CaptionSyncSection />
        <GlideSyncSection />
      </div>
    </div>
  );
};

export default Settings;