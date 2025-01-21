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

  const handleVideoHover = (videoElement: HTMLVideoElement) => {
    if (!isPlaying) {
      videoElement.play().catch(error => {
        console.log("Autoplay prevented:", error);
      });
    }
  };

  const handleVideoLeave = (videoElement: HTMLVideoElement) => {
    if (!isPlaying) {
      videoElement.pause();
      videoElement.currentTime = 0;
    }
  };

  const handlePlayClick = (e: React.MouseEvent<HTMLButtonElement>, video: HTMLVideoElement) => {
    e.stopPropagation();
    if (video.paused) {
      video.play();
      video.loop = true;  // Enable looping when playing
      setIsPlaying(true);
    } else {
      video.pause();
      video.loop = false; // Disable looping when stopped
      video.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleVideoError = (video: HTMLVideoElement, defaultUrl: string) => {
    if (video.src !== defaultUrl) {
      video.src = defaultUrl;
    }
  };

  const handleImageError = (img: HTMLImageElement, defaultUrl: string) => {
    if (img.src !== defaultUrl) {
      img.src = defaultUrl;
    }
  };

  return (
    <Card className="overflow-hidden group relative hover:shadow-lg transition-all duration-300" onClick={() => onPreview(item)}>
      <div className="aspect-square relative">
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <Button
            variant="outline"
            size="icon"
            className="bg-white/80 hover:bg-white"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {item.file_type === 'video' && (
            <Button
              variant="outline"
              size="icon"
              className="bg-white/80 hover:bg-white"
              onClick={(e) => handlePlayClick(e, e.currentTarget.parentElement?.parentElement?.querySelector('video') as HTMLVideoElement)}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          )}
        </div>
        {item.file_type === 'video' ? (
          <div className="relative h-full">
            <video 
              src={item.public_url || item.default_public_url}
              className="object-cover w-full h-full"
              muted
              playsInline
              onMouseEnter={(e) => handleVideoHover(e.target as HTMLVideoElement)}
              onMouseLeave={(e) => handleVideoLeave(e.target as HTMLVideoElement)}
              onError={(e) => handleVideoError(e.target as HTMLVideoElement, item.default_public_url)}
            />
          </div>
        ) : (
          <img
            src={item.public_url || item.default_public_url}
            alt={item.caption || "Media item"}
            className="object-cover w-full h-full"
            onError={(e) => handleImageError(e.target as HTMLImageElement, item.default_public_url)}
          />
        )}
      </div>
      <div className="p-4 bg-white border-t">
        <p className="text-center text-base font-medium mb-1">
          {item.caption || 'No caption'}
        </p>
        <div className="flex justify-between items-end text-xs text-gray-600 px-0.5 mt-1">
          <span className="pl-0.5">{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : '-'}</span>
          <span className="capitalize pr-0.5">{item.file_type}</span>
        </div>
      </div>
      <div className="p-2 text-sm space-y-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-full group-hover:translate-y-0 bg-white absolute bottom-0 left-0 right-0">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          <div>
            <p className="font-medium truncate">{item.product_name || 'Untitled'}</p>
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
