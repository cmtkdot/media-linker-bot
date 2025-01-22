import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Play, Pause } from "lucide-react";

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
    thumbnail_url?: string;
    telegram_data?: {
      chat?: {
        type?: string;
        title?: string;
      };
    };
  };
  onEdit: (item: any) => void;
  onPreview: (item: any) => void;
}

const MediaCard = ({ item, onEdit, onPreview }: MediaCardProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const handleVideoClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        videoRef.current.src = item.public_url || item.default_public_url;
        await videoRef.current.load();
        await videoRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error("Video playback error:", error);
      setError("Failed to play video");
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.target as HTMLVideoElement;
    console.error("Video error:", video.error);
    setError("Error loading video");
    setIsLoading(false);
    
    // Try fallback URL if current URL fails
    if (video.src === item.public_url && item.default_public_url) {
      video.src = item.default_public_url;
      video.load();
    }
  };

  const handleVideoLoadedData = () => {
    setIsLoading(false);
    setError(null);
  };

  React.useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, []);

  return (
    <Card 
      className="group relative overflow-hidden bg-card hover:shadow-lg transition-all duration-300 rounded-xl border-0 flex flex-col h-full cursor-pointer" 
      onClick={() => onPreview(item)}
    >
      <div className="aspect-square relative">
        {item.file_type === 'video' ? (
          <div className="relative h-full" onClick={handleVideoClick}>
            <video
              ref={videoRef}
              className="object-cover w-full h-full"
              poster={item.thumbnail_url || item.default_public_url}
              playsInline
              muted
              preload="metadata"
              onLoadedData={handleVideoLoadedData}
              onEnded={() => setIsPlaying(false)}
              onError={handleVideoError}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
              {error ? (
                <p className="text-white bg-red-500/80 px-3 py-1 rounded-md text-sm">
                  {error}
                </p>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-12 h-12 rounded-full bg-white/90 hover:bg-white group-hover:scale-110 transition-transform"
                  onClick={handleVideoClick}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="h-6 w-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-6 w-6 text-black" />
                  ) : (
                    <Play className="h-6 w-6 text-black" />
                  )}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <img
            src={item.public_url || item.default_public_url}
            alt={item.caption || "Media item"}
            className="object-cover w-full h-full"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              if (img.src !== item.default_public_url) {
                img.src = item.default_public_url;
              }
            }}
          />
        )}

        {/* Hover overlay - always present but only visible on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute top-4 right-4 pointer-events-auto">
            <Button
              variant="outline"
              size="icon"
              className="bg-white/90 hover:bg-white"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
            >
              <Pencil className="h-4 w-4 text-black" />
            </Button>
          </div>
          <div className="absolute bottom-4 left-4 text-white">
            <p className="text-sm font-medium">
              {item.telegram_data?.chat?.title || 'Unknown Channel'}
            </p>
            <p className="text-xs opacity-80">
              {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Static content - always visible */}
      <div className="p-4 bg-card">
        <h3 className="font-semibold text-lg text-foreground truncate mb-2">
          {item.product_name || 'Untitled Product'}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {item.caption || 'No caption'}
        </p>
      </div>
    </Card>
  );
};

export default MediaCard;