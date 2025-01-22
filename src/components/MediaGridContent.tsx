import { useState } from "react";
import { MediaItem } from "@/types/media";
import MediaCard from "./MediaCard";
import MediaViewer from "./MediaViewer";
import MediaEditDialog from "./MediaEditDialog";

interface MediaGridContentProps {
  items: MediaItem[];
  view: 'grid' | 'table';
  isLoading?: boolean;
  error?: Error | null;
  onMediaUpdate: () => Promise<void>;
}

const MediaGridContent = ({ items = [], view, onMediaUpdate }: MediaGridContentProps) => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleView = (item: MediaItem) => {
    setSelectedMedia(item);
    setViewerOpen(true);
  };

  const handleEdit = (item: MediaItem) => {
    setEditItem(item);
  };

  const handlePrevious = () => {
    if (!selectedMedia) return;
    const currentIndex = items.findIndex(item => item.id === selectedMedia.id);
    if (currentIndex > 0) {
      setSelectedMedia(items[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (!selectedMedia) return;
    const currentIndex = items.findIndex(item => item.id === selectedMedia.id);
    if (currentIndex < items.length - 1) {
      setSelectedMedia(items[currentIndex + 1]);
    }
  };

  const getCurrentIndex = () => {
    if (!selectedMedia) return -1;
    return items.findIndex(item => item.id === selectedMedia.id);
  };

  return (
    <>
      <div className={
        view === 'grid' 
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
          : "space-y-4"
      }>
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onPreview={() => handleView(item)}
            onEdit={handleEdit}
          />
        ))}
      </div>

      <MediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
        onPrevious={handlePrevious}
        onNext={handleNext}
        hasPrevious={getCurrentIndex() > 0}
        hasNext={getCurrentIndex() < items.length - 1}
      />

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={onMediaUpdate}
        onItemChange={(field, value) => {
          if (editItem) {
            setEditItem({ ...editItem, [field]: value });
          }
        }}
        formatDate={(date) => {
          if (!date) return null;
          return new Date(date).toISOString().split('T')[0];
        }}
      />
    </>
  );
};

export default MediaGridContent;