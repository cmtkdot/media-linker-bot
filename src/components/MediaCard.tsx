import { MediaItem } from "@/types/media";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Eye, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { getMediaCaption } from "@/utils/media-helpers";

export interface MediaCardProps {
  item: MediaItem;
  onPreview: () => void;
  onEdit: (item: MediaItem) => void;
  relatedMedia?: MediaItem[];
}

const MediaCard = ({ item, onPreview, onEdit, relatedMedia = [] }: MediaCardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackImage = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d";

  // Combine current item with related media
  const allMedia = [item, ...relatedMedia.filter(m => m.id !== item.id)];
  const currentItem = allMedia[currentIndex];
  
  // Auto-advance to video on hover if available
  useEffect(() => {
    if (isHovering) {
      const videoIndex = allMedia.findIndex(m => m.file_type === 'video');
      if (videoIndex !== -1 && videoIndex !== currentIndex) {
        setCurrentIndex(videoIndex);
      }
    }
  }, [isHovering, allMedia]);

  // Auto-play video on hover
  useEffect(() => {
    if (isHovering && videoRef.current && currentItem.file_type === 'video') {
      videoRef.current.play().catch(console.error);
    }
  }, [isHovering, currentItem]);

  const getDisplayUrl = (mediaItem: MediaItem) => {
    return mediaItem.public_url || fallbackImage;
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allMedia.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length);
  };

  return (
    <Card 
      className="group relative overflow-hidden"
      onMouseEnter={() => setIsHovering(true)}
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
            {currentItem.file_type === 'video' ? (
              <div className="relative w-full h-full">
                <video
                  ref={videoRef}
                  src={getDisplayUrl(currentItem)}
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
                src={getDisplayUrl(currentItem)}
                alt={getMediaCaption(currentItem)}
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

          {/* Navigation arrows */}
          {allMedia.length > 1 && (
            <div className="absolute inset-0 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-2 bg-black/20 hover:bg-black/40"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 mr-2 bg-black/20 hover:bg-black/40"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
              >
                <ChevronRight className="h-4 w-4 text-white" />
              </Button>
            </div>
          )}

          {/* Dots indicator */}
          {allMedia.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
              {allMedia.map((_, index) => (
                <button
                  key={index}
                  className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all",
                    index === currentIndex
                      ? "bg-white scale-100"
                      : "bg-white/50 scale-90 hover:scale-100"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(index);
                  }}
                />
              ))}
            </div>
          )}

          {/* Processing status indicator */}
          {currentItem.message_media_data?.meta?.status === 'processing' && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white px-2 py-1 rounded-full text-xs">
              Processing...
            </div>
          )}

          {/* Error indicator */}
          {currentItem.message_media_data?.meta?.status === 'error' && (
            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs">
              Error
            </div>
          )}

          {/* Hover overlay with actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={onPreview}>
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onEdit(currentItem)}>
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </div>

        {/* Media info */}
        <div className="p-3">
          <p className="text-sm font-medium truncate">
            {getMediaCaption(currentItem)}
          </p>
          <p className="text-xs text-muted-foreground">
            {currentItem.file_type.charAt(0).toUpperCase() + currentItem.file_type.slice(1)}
            {allMedia.length > 1 && ` • ${currentIndex + 1}/${allMedia.length}`}
            {currentItem.message_media_data?.meta?.retry_count > 0 && 
              ` • Retries: ${currentItem.message_media_data.meta.retry_count}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MediaCard;