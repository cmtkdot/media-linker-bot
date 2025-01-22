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
  };
  onEdit: (item: any) => void;
  onPreview: (item: any) => void;
}

const MediaCard = ({ item, onEdit, onPreview }: MediaCardProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Cleanup function for video element
  React.useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
    };
  }, []);

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      try {
        if (isPlaying) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        } else {
          // Reset video source before playing to prevent stale state
          if (!videoRef.current.src) {
            videoRef.current.src = item.public_url || item.default_public_url;
          }
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error("Video playback error:", error);
              setIsPlaying(false);
            });
          }
        }
        setIsPlaying(!isPlaying);
      } catch (error) {
        console.error("Video interaction error:", error);
        setIsPlaying(false);
      }
    }
  };

  return (
    <Card 
      className="group relative overflow-hidden bg-card hover:shadow-lg transition-all duration-300 rounded-xl border-0" 
      onClick={() => onPreview(item)}
    >
      <div className="aspect-square relative">
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/20">
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
        {item.file_type === 'video' ? (
          <div className="relative h-full cursor-pointer group" onClick={handleVideoClick}>
            <video
              ref={videoRef}
              className="object-cover w-full h-full"
              muted
              playsInline
              poster={item.default_public_url}
              preload="none"
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-colors">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="h-6 w-6 text-black" />
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
      <div className="p-3 bg-card border-t border-border/5">
        <p className="text-sm font-medium text-foreground truncate">
          {item.caption || 'No caption'}
        </p>
        <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
          <span>{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '-'}</span>
          <span className="capitalize">{item.file_type}</span>
        </div>
      </div>
      <div className="p-3 text-xs space-y-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-full group-hover:translate-y-0 bg-card/95 backdrop-blur-sm absolute bottom-0 left-0 right-0 border-t border-border/10">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div>
            <p className="font-medium truncate text-foreground">{item.product_name || 'Untitled'}</p>
            <p className="text-muted-foreground">Code: {item.product_code || '-'}</p>
            <p className="text-muted-foreground">Quantity: {item.quantity || '-'}</p>
            <p className="text-muted-foreground">Vendor: {item.vendor_uid || '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Type: {item.telegram_data?.chat?.type || '-'}</p>
            <p className="text-muted-foreground">Channel: {item.telegram_data?.chat?.title || '-'}</p>
            <p className="text-muted-foreground">Date: {item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '-'}</p>
            {item.notes && (
              <p className="text-muted-foreground">Notes: {item.notes}</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MediaCard;