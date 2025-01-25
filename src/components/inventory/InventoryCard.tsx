'use client';

import { MediaItem } from "@/types/media";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Eye, Edit, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getMediaCaption } from "@/utils/media-helpers";

interface InventoryCardProps {
  item: MediaItem;
  onPreview: () => void;
  onEdit: (item: MediaItem) => void;
  relatedMedia?: MediaItem[];
}

export function InventoryCard({ item, onPreview, onEdit, relatedMedia = [] }: InventoryCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const fallbackImage = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d";

  // Combine current item with related media
  const allMedia = [item, ...relatedMedia.filter(m => m.id !== item.id)];
  const currentItem = allMedia[currentIndex];
  
  // Auto-advance to video on hover if available and not on mobile
  useEffect(() => {
    if (isHovering && !isMobile) {
      const videoIndex = allMedia.findIndex(m => m.file_type === 'video');
      if (videoIndex !== -1 && videoIndex !== currentIndex) {
        setCurrentIndex(videoIndex);
      }
    }
  }, [isHovering, allMedia, isMobile, currentIndex]);

  // Auto-play video on hover if not on mobile
  useEffect(() => {
    if (isHovering && !isMobile && videoRef.current && currentItem.file_type === 'video') {
      videoRef.current.play().catch(console.error);
    }
  }, [isHovering, currentItem, isMobile]);

  const getDisplayUrl = (mediaItem: MediaItem) => {
    if (mediaItem.file_type === 'video') {
      if (mediaItem.thumbnail_state === 'downloaded' || mediaItem.thumbnail_state === 'generated') {
        return !isHovering || isMobile ? mediaItem.thumbnail_url : mediaItem.public_url;
      }
      return mediaItem.public_url || mediaItem.default_public_url || fallbackImage;
    }
    return mediaItem.public_url || mediaItem.default_public_url || fallbackImage;
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allMedia.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const touchStartX = touch.clientX;
    const touchStartY = touch.clientY;

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      // Only handle horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          handlePrevious();
        } else {
          handleNext();
        }
        cleanup();
      }
    };

    const cleanup = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', cleanup);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', cleanup);
  };

  return (
    <Card 
      className="group relative overflow-hidden"
      onMouseEnter={() => !isMobile && setIsHovering(true)}
      onMouseLeave={() => {
        if (!isMobile) {
          setIsHovering(false);
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
          }
        }
      }}
      onTouchStart={handleTouchStart}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square">
          {/* Media preview */}
          <div className="absolute inset-0 bg-gray-100">
            {currentItem.file_type === 'video' ? (
              <div className="relative w-full h-full">
                {isHovering && !isMobile ? (
                  <video
                    ref={videoRef}
                    src={getDisplayUrl(currentItem)}
                    className="w-full h-full object-cover"
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <>
                    <img
                      src={getDisplayUrl(currentItem)}
                      alt={getMediaCaption(currentItem) || 'Video thumbnail'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (img.src !== fallbackImage) {
                          img.src = fallbackImage;
                        }
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PlayCircle className="w-12 h-12 text-white opacity-75" />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <img
                src={getDisplayUrl(currentItem)}
                alt={getMediaCaption(currentItem) || 'Media item'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== fallbackImage) {
                    img.src = fallbackImage;
                  }
                }}
              />
            )}
          </div>

          {/* Navigation arrows - show on hover for desktop, always for mobile */}
          {allMedia.length > 1 && (
            <div className={cn(
              "absolute inset-0 flex items-center justify-between transition-opacity",
              isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
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

          {/* Action buttons */}
          <div className={cn(
            "absolute top-2 right-2 flex gap-2 transition-opacity",
            isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-black/20 hover:bg-black/40"
              onClick={(e) => {
                e.stopPropagation();
                setShowInfo(!showInfo);
              }}
            >
              <Info className="h-4 w-4 text-white" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-black/20 hover:bg-black/40"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
            >
              <Eye className="h-4 w-4 text-white" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 bg-black/20 hover:bg-black/40"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(currentItem);
              }}
            >
              <Edit className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>

        {/* Info panel - slides up on mobile */}
        <div className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-black/40 text-white transition-transform duration-300 p-4",
          showInfo ? "translate-y-0" : "translate-y-full"
        )}>
          <h3 className="font-medium text-sm mb-1">
            {currentItem.product_name || 'Untitled Product'}
          </h3>
          {getMediaCaption(currentItem) && (
            <p className="text-sm opacity-90 line-clamp-2">
              {getMediaCaption(currentItem)}
            </p>
          )}
          {currentItem.product_code && (
            <p className="text-sm opacity-90 mt-1">
              Code: {currentItem.product_code}
            </p>
          )}
          <p className="text-xs opacity-75 mt-2">
            {currentItem.file_type.charAt(0).toUpperCase() + currentItem.file_type.slice(1)}
            {allMedia.length > 1 && ` • ${currentIndex + 1}/${allMedia.length}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}