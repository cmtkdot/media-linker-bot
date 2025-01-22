import React from "react";
import { Card } from "@/components/ui/card";
import { Play, Edit } from "lucide-react";
import { MediaItem } from "@/types/media";
import { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";

interface MediaCardProps {
  item: MediaItem;
  onPreview: () => void;
  onEdit: Dispatch<SetStateAction<MediaItem | null>>;
}

const MediaCard = ({ item, onPreview, onEdit }: MediaCardProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Get the display URL for the media item
  const getDisplayUrl = () => {
    if (item.file_type === 'video') {
      return item.thumbnail_url || item.default_public_url;
    }
    return item.public_url || item.default_public_url;
  };

  // Get the video URL (actual video file, not thumbnail)
  const getVideoUrl = () => {
    return item.public_url || item.default_public_url;
  };

  const handleMouseEnter = async () => {
    if (item.file_type === 'video' && videoRef.current) {
      try {
        videoRef.current.src = getVideoUrl();
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
        }
      } catch (error) {
        console.error("Video playback error:", error);
      }
    }
  };

  const handleMouseLeave = () => {
    if (item.file_type === 'video' && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onEdit(item);
  };

  return (
    <Card 
      className="group relative overflow-hidden bg-card hover:shadow-lg transition-all duration-300 rounded-xl border-0 cursor-pointer" 
      onClick={onPreview}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Media Section - Fixed aspect ratio container */}
      <div className="relative aspect-square w-full">
        {item.file_type === 'video' ? (
          <>
            <img
              src={getDisplayUrl()}
              alt={item.caption || "Video thumbnail"}
              className={`absolute inset-0 w-full h-full object-cover ${isPlaying ? 'hidden' : 'block'}`}
            />
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover ${isPlaying ? 'block' : 'hidden'}`}
              muted
              playsInline
              preload="none"
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="h-6 w-6 text-black" />
                </div>
              </div>
            )}
          </>
        ) : (
          <img
            src={getDisplayUrl()}
            alt={item.caption || "Media item"}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Edit Button Overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white"
            onClick={handleEditClick}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3 bg-card">
        <p className="font-medium text-foreground truncate">
          {item.product_name || 'Untitled Product'}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
          {item.caption || 'No caption'}
        </p>
      </div>
    </Card>
  );
};

export default MediaCard;