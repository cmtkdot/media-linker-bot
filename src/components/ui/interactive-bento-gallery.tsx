import React from "react";
import { MediaItem } from "@/types/media";
import { getMediaCaption } from "@/utils/media-helpers";

interface InteractiveBentoGalleryProps {
  items: MediaItem[];
  onMediaClick: (media: MediaItem) => void;
}

const InteractiveBentoGallery: React.FC<InteractiveBentoGalleryProps> = ({ items, onMediaClick }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative cursor-pointer"
          onClick={() => onMediaClick(item)}
        >
          <img
            src={item.thumbnail_url || item.public_url}
            alt={getMediaCaption(item)}
            className="w-full h-full object-cover rounded-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-white font-semibold">{getMediaCaption(item)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InteractiveBentoGallery;
