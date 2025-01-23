import React from "react";
import { MediaItem } from "@/types/media";
import InteractiveBentoGallery from "@/components/ui/interactive-bento-gallery";

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
  relatedMedia = [],
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false 
}: MediaViewerProps) => {
  if (!media) return null;

  const mediaItems = relatedMedia.map((item, index) => ({
    id: index + 1,
    type: item.file_type === 'video' ? 'video' : 'image',
    title: item.product_name || 'Media Item',
    desc: item.caption || '',
    url: item.public_url || item.default_public_url || '',
    span: 'md:col-span-1 md:row-span-2'
  }));

  return (
    <div className={`fixed inset-0 z-50 ${open ? 'block' : 'hidden'}`}>
      <InteractiveBentoGallery
        mediaItems={mediaItems}
        title={media.product_name || "Media Gallery"}
        description={media.caption || ""}
      />
    </div>
  );
};

export default MediaViewer;