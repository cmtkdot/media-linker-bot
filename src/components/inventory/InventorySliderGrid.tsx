'use client';

import { useState } from "react";
import { InventoryCard } from "./InventoryCard";
import { InventoryViewer } from "./InventoryViewer";
import { MediaItem } from "@/types/media";
import { useMediaQuery } from "@/hooks/use-media-query";

interface InventorySliderGridProps {
  initialItems: MediaItem[];
}

export function InventorySliderGrid({ initialItems }: InventorySliderGridProps) {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Group media items by their media_group_id
  const mediaGroups = initialItems.reduce((groups, item) => {
    const groupId = item.media_group_id || item.id;
    if (!groups[groupId]) {
      groups[groupId] = [];
    }
    groups[groupId].push(item);
    return groups;
  }, {} as Record<string, MediaItem[]>);

  // Convert groups to array and sort by latest item in each group
  const sortedGroups = Object.values(mediaGroups).sort((a, b) => {
    const latestA = Math.max(...a.map(item => new Date(item.created_at).getTime()));
    const latestB = Math.max(...b.map(item => new Date(item.created_at).getTime()));
    return latestB - latestA;
  });

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {sortedGroups.map((group) => {
          const mainItem = group[0];
          return (
            <InventoryCard
              key={mainItem.id}
              item={mainItem}
              relatedMedia={group.slice(1)}
              onPreview={() => {
                setSelectedMedia(mainItem);
                setViewerOpen(true);
              }}
              onEdit={(item) => {
                // TODO: Implement edit functionality
                console.log('Edit item:', item);
              }}
            />
          );
        })}
      </div>

      <InventoryViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
        relatedMedia={selectedMedia?.media_group_id 
          ? sortedGroups.find(group => 
              group.some(item => item.id === selectedMedia.id)
            )?.filter(item => item.id !== selectedMedia.id) || []
          : []
        }
      />
    </div>
  );
}
