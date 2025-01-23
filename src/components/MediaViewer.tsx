import React from "react";
import { MediaItem } from "@/types/media";
import GalleryModal from "./ui/interactive-bento-gallery";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
}

const MediaViewer = ({ 
  open, 
  onOpenChange, 
  media
}: MediaViewerProps) => {
  if (!media) return null;
  
  const mediaItems = [media];

  return (
    <GalleryModal
      selectedItem={media}
      isOpen={open}
      onClose={() => onOpenChange(false)}
      setSelectedItem={(item) => {
        if (!item) {
          onOpenChange(false);
        }
      }}
      mediaItems={mediaItems}
    />
  );
};

export default MediaViewer;