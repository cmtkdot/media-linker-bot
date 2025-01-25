import React from "react";
import { MediaItem } from "@/types/media";
import { getMediaCaption } from "@/utils/media-helpers";
import { cn } from "@/lib/utils";

interface ImageSwiperProps {
  items: MediaItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function ImageSwiper({ items, currentIndex, onSelect, className }: ImageSwiperProps) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto py-2", className)}>
      {items.map((item, index) => (
        <button
          key={item.id}
          className={cn(
            "relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden",
            currentIndex === index && "ring-2 ring-primary"
          )}
          onClick={() => onSelect(index)}
        >
          {item.file_type === 'video' ? (
            <video
              src={item.public_url}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
              playsInline
            />
          ) : (
            <img
              src={item.public_url}
              alt={item.analyzed_content?.product_name || "Media preview"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </button>
      ))}
    </div>
  );
}
