'use client';

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { MediaItem } from "@/types/media";
import { getMediaCaption } from "@/utils/media-helpers";

interface InventoryViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
}

export function InventoryViewer({ 
  open, 
  onOpenChange, 
  media
}: InventoryViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  if (!media) return null;

  const mediaUrl = media.public_url;
  const isVideo = media.file_type === 'video';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0">
        {/* Media viewer */}
        <div className="relative aspect-video bg-black">
          {isVideo ? (
            <video
              src={mediaUrl}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
              onLoadStart={() => setIsLoading(true)}
              onLoadedData={() => setIsLoading(false)}
            />
          ) : (
            <img
              src={mediaUrl}
              alt={getMediaCaption(media) || "Media preview"}
              className="w-full h-full object-contain"
              onLoad={() => setIsLoading(false)}
            />
          )}
        </div>

        {/* Info panel */}
        <div className="p-6">
          <div className="space-y-4">
            {getMediaCaption(media) && (
              <div>
                <h3 className="font-medium">Caption</h3>
                <p className="text-sm text-muted-foreground">{getMediaCaption(media)}</p>
              </div>
            )}
            <div>
              <h3 className="font-medium">Details</h3>
              <dl className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <dt>Type</dt>
                  <dd>{media.file_type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Created</dt>
                  <dd>{media.created_at ? new Date(media.created_at).toLocaleDateString() : 'Unknown'}</dd>
                </div>
                {media.media_group_id && (
                  <div className="flex justify-between">
                    <dt>Group ID</dt>
                    <dd>{media.media_group_id}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
