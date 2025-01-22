import { MediaItem } from "@/types/media";
import MediaViewer from "./MediaViewer";
import MediaCard from "./MediaCard";
import { Alert, AlertDescription } from "./ui/alert";
import { Loader2 } from "lucide-react";

interface MediaGridContentProps {
  view: 'grid' | 'table';  // Added this prop
  isLoading: boolean;
  error: Error | null;
  mediaItems: MediaItem[] | undefined;
  previewItem: MediaItem | null;
  onPreviewChange: (open: boolean) => void;
}

const MediaGridContent = ({
  view,
  isLoading,
  error,
  mediaItems,
  previewItem,
  onPreviewChange,
}: MediaGridContentProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading media...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!mediaItems?.length) {
    return (
      <Alert variant="default" className="m-4">
        <AlertDescription>No media items found</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {mediaItems.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onPreview={() => onPreviewChange(true)}
          />
        ))}
      </div>
      <MediaViewer
        open={!!previewItem}
        onOpenChange={onPreviewChange}
        media={previewItem}
      />
    </>
  );
};

export default MediaGridContent;