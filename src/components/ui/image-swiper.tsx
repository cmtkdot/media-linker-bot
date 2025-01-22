'use client'

import * as React from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MediaItem } from '@/types/media'

interface ImageSwiperProps extends React.HTMLAttributes<HTMLDivElement> {
  items: MediaItem[];
}

export function ImageSwiper({ items, className, ...props }: ImageSwiperProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const dragX = useMotionValue(0)
  const videoRef = React.useRef<HTMLVideoElement>(null)

  const onDragEnd = () => {
    const x = dragX.get()
    if (x <= -10 && currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else if (x >= 10 && currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleVideoClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error("Video playback error:", error);
      setIsPlaying(false);
    }
  };

  const renderMediaItem = (item: MediaItem, index: number) => {
    const displayUrl = item.thumbnail_url || item.public_url || item.default_public_url;

    if (item.file_type === 'video') {
      return (
        <div className="relative h-full w-full" onClick={handleVideoClick}>
          {/* Video Thumbnail */}
          {!isPlaying && (
            <img
              src={displayUrl}
              alt={item.caption || `Video ${index + 1}`}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )}
          
          {/* Video Element */}
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              isPlaying ? "opacity-100" : "opacity-0"
            )}
            src={item.public_url}
            muted
            playsInline
            preload="none"
          />

          {/* Play Button Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="h-6 w-6 text-black" />
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <img
        src={displayUrl}
        alt={item.caption || `Image ${index + 1}`}
        className="h-full w-full object-cover pointer-events-none"
      />
    );
  };

  return (
    <div
      className={cn(
        'group relative aspect-square h-full w-full overflow-hidden rounded-lg',
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 z-10">
        {currentIndex > 0 && (
          <div className="absolute left-5 top-1/2 -translate-y-1/2">
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setCurrentIndex((prev) => prev - 1)}
            >
              <ChevronLeft className="h-4 w-4 text-neutral-600" />
            </Button>
          </div>
        )}
        
        {currentIndex < items.length - 1 && (
          <div className="absolute right-5 top-1/2 -translate-y-1/2">
            <Button
              variant="ghost" 
              size="icon"
              className="pointer-events-auto h-8 w-8 rounded-full bg-white/80 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setCurrentIndex((prev) => prev + 1)}
            >
              <ChevronRight className="h-4 w-4 text-neutral-600" />
            </Button>
          </div>
        )}

        <div className="absolute bottom-2 w-full flex justify-center">
          <div className="flex min-w-9 items-center justify-center rounded-md bg-black/80 px-2 py-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            {currentIndex + 1}/{items.length}
          </div>
        </div>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{
          left: 0,
          right: 0
        }}
        dragMomentum={false}
        style={{
          x: dragX
        }}
        animate={{
          translateX: `-${currentIndex * 100}%`
        }}
        onDragEnd={onDragEnd}
        transition={{ damping: 18, stiffness: 90, type: 'spring', duration: 0.2 }}
        className="flex h-full cursor-grab items-center rounded-[inherit] active:cursor-grabbing"
      >
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            className="h-full w-full shrink-0 overflow-hidden bg-neutral-800 object-cover first:rounded-l-[inherit] last:rounded-r-[inherit]"
          >
            {renderMediaItem(item, i)}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
