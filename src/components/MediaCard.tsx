import React from "react";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import { MediaItem } from "@/types/media";
import MediaActions from "./MediaActions";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { cn } from "@/lib/utils";

interface MediaCardProps {
  item: MediaItem;
  onPreview: () => void;
  onEdit: (item: MediaItem) => void;
}

const MediaCard = ({ item, onPreview, onEdit }: MediaCardProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const supabase = useSupabaseClient();

  // Reset states when item changes
  React.useEffect(() => {
    setIsPlaying(false);
    setIsVideoLoaded(false);
  }, [item.id]);

  const getDisplayUrl = () => {
    if (item.file_type === 'video') {
      // Try thumbnail URL first
      if (item.thumbnail_url) {
        return item.thumbnail_url;
      }

      // Try to get thumbnail from Telegram metadata
      const videoData = item.telegram_data?.message_data?.video;
      if (videoData?.thumb?.file_unique_id) {
        const { data } = supabase
          .storage
          .from('media')
          .getPublicUrl(`${videoData.thumb.file_unique_id}.jpg`);
        
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      }

      // Try other video metadata sources
      if (item.media_metadata?.thumbnail_path) {
        const { data } = supabase
          .storage
          .from('media')
          .getPublicUrl(item.media_metadata.thumbnail_path);
        
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      }

      // Final fallback chain
      return item.public_url || item.default_public_url;
    }

    // For non-video items
    return item.public_url || item.default_public_url;
  };

  const handleVideoClick = () => {
    if (!videoRef.current) return;

    if (!isVideoLoaded) {
      // First load the video
      videoRef.current.src = item.public_url || item.default_public_url;
      videoRef.current.load();
      setIsVideoLoaded(true);
      
      // Add event listener for when video is ready
      const handleCanPlay = () => {
        videoRef.current?.play();
        setIsPlaying(true);
        videoRef.current?.removeEventListener('canplay', handleCanPlay);
      };
      videoRef.current.addEventListener('canplay', handleCanPlay);
    } else {
      // Video is already loaded, just toggle play/pause
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <Card className="group relative overflow-hidden">
      <div className="relative aspect-square bg-muted">
        {/* Thumbnail Image */}
        {item.file_type === 'video' && (
          <img
            src={getDisplayUrl()}
            alt={item.caption || 'Video thumbnail'}
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              isPlaying ? "opacity-0" : "opacity-100"
            )}
          />
        )}
        
        {/* Video Element */}
        {item.file_type === 'video' && (
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              isPlaying ? "opacity-100" : "opacity-0"
            )}
            muted
            playsInline
            preload="none"
            onClick={handleVideoClick}
            onEnded={() => setIsPlaying(false)}
          />
        )}

        {/* Image */}
        {item.file_type !== 'video' && (
          <img
            src={getDisplayUrl()}
            alt={item.caption || ''}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Play Button Overlay */}
        {item.file_type === 'video' && !isPlaying && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors cursor-pointer"
            onClick={handleVideoClick}
          >
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="h-6 w-6 text-black" />
            </div>
          </div>
        )}
      </div>

      <MediaActions item={item} onPreview={onPreview} onEdit={onEdit} />
    </Card>
  );
};

export default MediaCard;