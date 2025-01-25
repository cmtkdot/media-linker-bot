import React from "react";
import { MediaItem } from "@/types/media";
import { getMediaCaption } from "@/utils/media-helpers";

interface ImageSwiperProps {
  items: MediaItem[];
  onMediaClick: (media: MediaItem) => void;
}

const ImageSwiper: React.FC<ImageSwiperProps> = ({ items, onMediaClick }) => {
  return (
    <div className="swiper-container">
      <div className="swiper-wrapper">
        {items.map((item) => (
          <div className="swiper-slide" key={item.id} onClick={() => onMediaClick(item)}>
            <img
              src={item.thumbnail_url || item.public_url}
              alt={getMediaCaption(item)}
              className="w-full h-full object-cover"
            />
            <div className="caption">{getMediaCaption(item)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageSwiper;
