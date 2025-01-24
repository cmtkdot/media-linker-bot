'use client';

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Image as ImageIcon, 
  Video,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info
} from "lucide-react";
import { MediaItem } from "@/types/media";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

interface InventoryViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  relatedMedia?: MediaItem[];
}

export function InventoryViewer({ 
  open, 
  onOpenChange, 
  media,
  relatedMedia = []
}: InventoryViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Reset states when media changes
  useEffect(() => {
    if (media) {
      const index = allMedia.findIndex(m => m.id === media.id);
      setCurrentIndex(index !== -1 ? index : 0);
      setZoom(1);
      setRotation(0);
    }
  }, [media]);

  if (!media) return null;

  // Combine current media with related media
  const allMedia = [media, ...relatedMedia.filter(m => m.id !== media.id)];
  const currentItem = allMedia[currentIndex];
  const mediaUrl = currentItem.public_url;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allMedia.length);
    setIsLoading(true);
    resetView();
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length);
    setIsLoading(true);
    resetView();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') resetView();
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const isVideo = currentItem.file_type === 'video';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-[95vw] max-w-7xl p-4 sm:p-6 h-[90vh] overflow-hidden flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="w-full relative mb-2 flex-shrink-0">
          <DialogTitle className="pr-8 flex items-center gap-2">
            {isVideo ? (
              <Video className="h-5 w-5" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
            {currentItem.caption || "Media Preview"}
            {allMedia.length > 1 && (
              <span className="text-sm text-muted-foreground">
                ({currentIndex + 1}/{allMedia.length})
              </span>
            )}
          </DialogTitle>
          <div className="absolute right-0 top-0 flex items-center gap-2">
            {!isVideo && (
              <>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={handleRotate}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setShowInfo(!showInfo)}
            >
              <Info className="h-4 w-4" />
            </Button>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>
        
        <div className="flex flex-1 min-h-0">
          {/* Main content */}
          <div className="flex-1 relative flex items-center justify-center bg-black/5 rounded-lg overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
            
            {isVideo ? (
              <video
                key={mediaUrl}
                src={mediaUrl}
                className={cn(
                  "max-h-full max-w-full object-contain transition-opacity duration-300",
                  isLoading ? "opacity-0" : "opacity-100"
                )}
                controls
                autoPlay
                playsInline
                onLoadedData={() => setIsLoading(false)}
              />
            ) : (
              <div
                className={cn(
                  "relative transition-all duration-300",
                  isLoading ? "opacity-0" : "opacity-100"
                )}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
              >
                <img
                  key={mediaUrl}
                  src={mediaUrl}
                  alt={currentItem.caption || "Media preview"}
                  className="max-h-[80vh] w-auto object-contain"
                  onLoad={() => setIsLoading(false)}
                />
              </div>
            )}

            {/* Navigation buttons */}
            {allMedia.length > 1 && (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none px-4">
                <Button
                  onClick={handlePrevious}
                  className="pointer-events-auto"
                  variant="secondary"
                  size="icon"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={handleNext}
                  className="pointer-events-auto"
                  variant="secondary"
                  size="icon"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Info sidebar - slides in from right */}
          <div className={cn(
            "absolute inset-y-0 right-0 w-80 bg-background/95 backdrop-blur-sm border-l p-4 overflow-y-auto transition-transform duration-300",
            showInfo ? "translate-x-0" : "translate-x-full"
          )}>
            <div className="space-y-4">
              {currentItem.caption && (
                <div>
                  <h3 className="font-medium">Caption</h3>
                  <p className="text-sm text-muted-foreground">{currentItem.caption}</p>
                </div>
              )}
              <div>
                <h3 className="font-medium">Details</h3>
                <dl className="text-sm text-muted-foreground space-y-1">
                  <div className="flex justify-between">
                    <dt>Type</dt>
                    <dd>{currentItem.file_type}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Created</dt>
                    <dd>{new Date(currentItem.created_at).toLocaleDateString()}</dd>
                  </div>
                  {currentItem.media_group_id && (
                    <div className="flex justify-between">
                      <dt>Group ID</dt>
                      <dd>{currentItem.media_group_id}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>

          {/* Thumbnails sidebar */}
          {!isMobile && allMedia.length > 1 && (
            <div className="w-24 ml-4 overflow-y-auto flex-shrink-0 hidden lg:block">
              <div className="space-y-2">
                {allMedia.map((item, index) => (
                  <button
                    key={item.id}
                    className={cn(
                      "w-full aspect-square rounded-lg overflow-hidden border-2 transition-all",
                      currentIndex === index
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-transparent hover:border-primary/50"
                    )}
                    onClick={() => {
                      setCurrentIndex(index);
                      setIsLoading(true);
                      resetView();
                    }}
                  >
                    <img
                      src={item.thumbnail_url || item.public_url}
                      alt={item.caption || `Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {item.file_type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile thumbnails strip */}
        {isMobile && allMedia.length > 1 && (
          <div className="mt-4 flex-shrink-0">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {allMedia.map((item, index) => (
                <button
                  key={item.id}
                  className={cn(
                    "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    currentIndex === index
                      ? "border-primary ring-1 ring-primary"
                      : "border-transparent hover:border-primary/50"
                  )}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsLoading(true);
                    resetView();
                  }}
                >
                  <img
                    src={item.thumbnail_url || item.public_url}
                    alt={item.caption || `Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {item.file_type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Video className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
