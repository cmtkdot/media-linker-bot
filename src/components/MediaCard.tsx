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
  const handleVideoHover = (videoElement: HTMLVideoElement) => {
    videoElement.play().catch(error => {
      console.log("Autoplay prevented:", error);
    });
  };

  const handleVideoLeave = (videoElement: HTMLVideoElement) => {
    videoElement.pause();
    videoElement.currentTime = 0;
  };

  const handlePlayClick = (e: React.MouseEvent<HTMLButtonElement>, video: HTMLVideoElement) => {
    e.stopPropagation();
    if (video.paused) {
      video.play();
    } else {
      video.pause();
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
    <Card className="overflow-hidden group relative">
      <Button
        variant="outline"
        size="icon"
        className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(item);
        }}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <div 
        className="aspect-square relative cursor-pointer" 
        onClick={() => onPreview(item)}
      >
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
            <Button
              variant="outline"
              size="icon"
              className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80"
              onClick={(e) => handlePlayClick(e, e.currentTarget.parentElement?.querySelector('video') as HTMLVideoElement)}
            >
              <Play className="h-4 w-4" />
            </Button>
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
      <div className="p-2 text-sm space-y-1">
        <p className="font-medium truncate">{item.product_name || 'Untitled'}</p>
        <p className="text-muted-foreground capitalize">{item.file_type}</p>
        {item.telegram_data?.chat?.type && (
          <p className="text-muted-foreground">Type: {item.telegram_data.chat.type}</p>
        )}
        {item.telegram_data?.chat?.title && (
          <p className="text-muted-foreground">Channel: {item.telegram_data.chat.title}</p>
        )}
        {item.quantity && (
          <p className="text-muted-foreground">Quantity: {item.quantity}</p>
        )}
        {item.vendor_uid && (
          <p className="text-muted-foreground">Vendor: {item.vendor_uid}</p>
        )}
        {item.purchase_date && (
          <p className="text-muted-foreground">Purchase Date: {new Date(item.purchase_date).toLocaleDateString()}</p>
        )}
        {item.notes && (
          <p className="text-muted-foreground">Notes: {item.notes}</p>
        )}
      </div>
    </Card>
  );
};

export default MediaCard;