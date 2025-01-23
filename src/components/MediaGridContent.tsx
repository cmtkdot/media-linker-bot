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
  onMediaUpdate: () => Promise<any>;
}

const MediaGridContent = ({ items = [], view, isLoading, error, onMediaUpdate }: MediaGridContentProps) => {
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

  if (isLoading) {
    return <div className="text-center py-8">Loading media items...</div>;
  }

  if (error) {
    return <div className="text-center py-8 text-red-500">Error loading media: {error.message}</div>;
  }

  if (items.length === 0) {
    return <div className="text-center py-8">No media items found</div>;
  }

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