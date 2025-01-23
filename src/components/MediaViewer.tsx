import React from "react";
import { MediaItem } from "@/types/media";
import GalleryModal from "./ui/interactive-bento-gallery";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  relatedMedia?: MediaItem[];
}

const MediaViewer = ({ 
  open, 
  onOpenChange, 
  media,
  relatedMedia = []
}: MediaViewerProps) => {
  if (!media) return null;

  const allMedia = relatedMedia.length > 0 ? relatedMedia : [media];
  
  // Sort media items to show photos first
  const sortedMedia = [...allMedia].sort((a, b) => {
    if (a.file_type === 'photo' && b.file_type !== 'photo') return -1;
    if (a.file_type !== 'photo' && b.file_type === 'photo') return 1;
    return 0;
  });

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
      mediaItems={sortedMedia}
    />
  );
};

export default MediaViewer;