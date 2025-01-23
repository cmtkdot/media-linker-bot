import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { MediaItem } from "@/types/media";
import InteractiveBentoGallery from "./ui/interactive-bento-gallery";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

const MediaViewer = ({
  open,
  onOpenChange,
  media,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
}: MediaViewerProps) => {
  if (!media) return null;

  const allMediaItems = [media, ...(media.related_media || [])].map((item, index) => ({
    id: index + 1,
    type: item.file_type === 'video' ? 'video' : 'image',
    title: item.product_name || 'Untitled',
    desc: item.caption || 'No caption',
    url: item.public_url || item.default_public_url || '',
    span: index === 0 ? 'md:col-span-2 md:row-span-2' : 'md:col-span-1 md:row-span-1'
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl p-4 sm:p-6 h-[90vh] sm:h-auto overflow-y-auto">
        <DialogHeader className="w-full relative mb-2">
          <DialogTitle className="pr-8 text-center">
            {media.product_name || "Media Preview"}
          </DialogTitle>
          <DialogClose className="absolute right-0 top-0">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <InteractiveBentoGallery
          mediaItems={allMediaItems}
          title={media.product_name || "Media Gallery"}
          description={media.caption || "Browse through related media items"}
        />
      </DialogContent>
    </Dialog>
  );
};

export default MediaViewer;