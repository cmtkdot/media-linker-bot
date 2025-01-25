'use client';

import { MediaItem } from "@/types/media";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Eye, Edit } from "lucide-react";
import { useRef, useState } from "react";

interface InventoryCardProps {
  item: MediaItem;
  onPreview: () => void;
  onEdit: () => void;
}

const InventoryCard = ({ item, onPreview, onEdit }: InventoryCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackImage = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d";

  const getDisplayUrl = () => {
    return item.public_url || fallbackImage;
  };

  return (
    <Card 
      className="group relative overflow-hidden"
      onMouseEnter={() => {
        setIsHovering(true);
        if (videoRef.current && item.file_type === 'video') {
          videoRef.current.play().catch(console.error);
        }
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square">
          {/* Media preview */}
          <div className="absolute inset-0 bg-gray-100">
            {item.file_type === 'video' ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  src={getDisplayUrl()}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                  playsInline
                  loop={isHovering}
                />
                {!isHovering && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="w-12 h-12 text-white opacity-75" />
                  </div>
                )}
              </div>
            ) : (
              <img
                src={getDisplayUrl()}
                alt={item.analyzed_content?.product_name || 'Product image'}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== fallbackImage) {
                    img.src = fallbackImage;
                  }
                }}
              />
            )}
          </div>

          {/* Hover overlay with actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={onPreview}>
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button size="sm" variant="secondary" onClick={onEdit}>
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </div>

        {/* Product info */}
        <div className="p-3">
          <p className="text-sm font-medium truncate">
            {item.analyzed_content?.product_name || 'Untitled Product'}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.analyzed_content?.product_code || 'No code'} • {item.file_type.charAt(0).toUpperCase() + item.file_type.slice(1)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default InventoryCard;