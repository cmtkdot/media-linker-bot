'use client';

import { MediaItem } from "@/types/media";
import { Dialog } from "@/components/ui/dialog";
import { Image } from "lucide-react";

interface InventoryViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  relatedMedia: MediaItem[];
}

export function InventoryViewer({ open, onOpenChange, media, relatedMedia }: InventoryViewerProps) {
  const isImage = media?.file_type === 'photo';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="p-4">
        {media && (
          <div>
            <h2 className="text-lg font-semibold">{media.caption || "Media Viewer"}</h2>
            {isImage ? (
              <img src={media.public_url} alt={media.caption} className="mt-2 w-full h-auto" />
            ) : (
              <div className="flex items-center justify-center mt-2">
                <Image className="w-16 h-16" />
                <span>Media type not supported for preview</span>
              </div>
            )}
            <div className="mt-4">
              <h3 className="text-md font-semibold">Related Media</h3>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {relatedMedia.map((item) => (
                  <div key={item.id} className="border rounded p-2">
                    <img src={item.thumbnail_url} alt={item.caption} className="w-full h-auto" />
                    <p className="text-sm">{item.caption}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
