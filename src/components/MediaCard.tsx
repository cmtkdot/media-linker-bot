import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Play } from "lucide-react";

interface MediaCardProps {
  item: {
    id: string;
    public_url: string;
    default_public_url: string;
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
    thumbnail_url?: string;
  };
  onEdit: (item: any) => void;
  onPreview: (item: any) => void;
}

const MediaCard = ({ item, onEdit, onPreview }: MediaCardProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Initialize video and handle cleanup
  React.useEffect(() => {
    if (item.file_type === 'video' && videoRef.current) {
      const video = videoRef.current;
      
      // Set initial poster image
      video.poster = item.thumbnail_url || item.default_public_url;
      video.src = item.public_url || item.default_public_url;
      
      // Handle video loaded
      const handleCanPlay = () => setIsLoaded(true);
      video.addEventListener('canplay', handleCanPlay);

      // Cleanup
      return () => {
        video.removeEventListener('canplay', handleCanPlay);
        video.pause();
        video.src = '';
        video.load();
      };
    }
  }, [item.file_type, item.public_url, item.default_public_url, item.thumbnail_url]);

  const handleVideoClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current || !isLoaded) return;

    try {
      if (isPlaying) {
        await videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      } else {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error("Video playback error:", error);
      setIsPlaying(false);
    }
  };

  return (
    <Card 
      className="group relative overflow-hidden bg-card hover:shadow-lg transition-all duration-300 rounded-xl border-0 flex flex-col h-full" 
      onClick={() => onPreview(item)}
    >
      {/* Media Section */}
      <div className="aspect-square relative">
        {item.file_type === 'video' ? (
          <div className="relative h-full cursor-pointer group" onClick={handleVideoClick}>
            <video
              ref={videoRef}
              className="object-cover w-full h-full"
              muted
              playsInline
              preload="metadata"
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                <div className={`w-12 h-12 rounded-full ${isLoaded ? 'bg-white/90' : 'bg-white/60'} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Play className={`h-6 w-6 ${isLoaded ? 'text-black' : 'text-black/60'}`} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <img
            src={item.public_url || item.default_public_url}
            alt={item.caption || "Media item"}
            className="object-cover w-full h-full"
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

      {/* Hover Info Section */}
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