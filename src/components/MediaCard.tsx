import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Play } from "lucide-react";

interface MediaItem {
  id: string;
  public_url: string;
  default_public_url: string;
  thumbnail_url?: string;
  file_type: string;
  caption?: string;
  product_name?: string;
  product_code?: string;
  quantity?: number;
  vendor_uid?: string;
  purchase_date?: string;
  notes?: string;
  telegram_data?: {
    chat?: {
      type?: string;
      title?: string;
    };
  };
}

interface MediaCardProps {
  item: MediaItem;
  onEdit: (item: MediaItem) => void;
  onPreview: (item: MediaItem) => void;
}

const MediaCard = ({ item, onEdit, onPreview }: MediaCardProps) => {
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

  const handleVideoClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } else {
        videoRef.current.src = getVideoUrl();
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

  return (
    <Card 
      className="group relative overflow-hidden bg-card hover:shadow-lg transition-all duration-300 rounded-xl border-0" 
      onClick={() => onPreview(item)}
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
            <div 
              className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors cursor-pointer"
              onClick={handleVideoClick}
            >
              {!isPlaying && (
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="h-6 w-6 text-black" />
                </div>
              )}
            </div>
          </>
        ) : (
          <img
            src={getDisplayUrl()}
            alt={item.caption || "Media item"}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

      {/* Static Info Section */}
      <div className="p-3 bg-card">
        <p className="font-medium text-foreground truncate">
          {item.product_name || 'Untitled Product'}
        </p>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
          {item.caption || 'No caption'}
        </p>
      </div>

      {/* Hover Info Section - Channel, Date, Edit */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-medium">
                {item.telegram_data?.chat?.title || 'Unknown Channel'}
              </p>
              <p className="text-xs opacity-80">
                {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '-'}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="bg-white/90 hover:bg-white shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
            >
              <Pencil className="h-4 w-4 text-black" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MediaCard;