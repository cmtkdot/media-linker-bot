import React, { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, X, MessageSquare, Users, Play, Pause } from "lucide-react";

interface MediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: {
    public_url: string;
    default_public_url: string;
    file_type: string;
    caption?: string;
    product_name?: string;
    product_code?: string;
    purchase_order_uid?: string;
    quantity?: number;
    vendor_uid?: string;
    purchase_date?: string;
    notes?: string;
    message_url?: string;
    chat_url?: string;
    telegram_data?: {
      chat?: {
        type?: string;
        title?: string;
      };
    };
  } | null;
}

const MediaViewer = ({ open, onOpenChange, media }: MediaViewerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  if (!media) return null;

  const mediaUrl = media.public_url || media.default_public_url;
  const telegramType = media.telegram_data?.chat?.type;
  const telegramTitle = media.telegram_data?.chat?.title;

  const handleVideoPlayback = async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        videoRef.current.src = mediaUrl;
        await videoRef.current.load();
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
        }
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
    if (video.src === media.public_url && media.default_public_url) {
      video.src = media.default_public_url;
      video.load();
    }
  };

  const handleVideoLoadedData = () => {
    setIsLoading(false);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl p-4 sm:p-6 h-[90vh] sm:h-auto overflow-y-auto">
        <DialogHeader className="w-full relative mb-2">
          <DialogTitle className="pr-8 text-center">
            {media.product_name || "Media Preview"}
          </DialogTitle>
          <DialogClose className="absolute right-0 top-0">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Media Column */}
          <div className="flex-[1.5] min-h-0">
            <div className="relative bg-black/5 rounded-lg overflow-hidden flex items-center justify-center" style={{ 
              height: '50vh',
              maxHeight: 'calc(100vh - 300px)',
              minHeight: '300px'
            }}>
              {media.file_type === "video" ? (
                <div className="relative w-full h-full">
                  <video
                    ref={videoRef}
                    src={mediaUrl}
                    className="h-full w-full object-contain"
                    poster={media.default_public_url}
                    playsInline
                    onEnded={() => setIsPlaying(false)}
                    onError={(e) => {
                      const video = e.target as HTMLVideoElement;
                      if (video.src !== media.default_public_url) {
                        video.src = media.default_public_url;
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full"
                    onClick={handleVideoPlayback}
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6 text-black" />
                    ) : (
                      <Play className="h-6 w-6 text-black" />
                    )}
                  </Button>
                </div>
              ) : (
                <img
                  src={mediaUrl}
                  alt={media.caption || "Media preview"}
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.src !== media.default_public_url) {
                      img.src = media.default_public_url;
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Details Column */}
          <div className="flex-1 flex flex-col space-y-4 overflow-y-auto">
            {media.caption && (
              <p className="text-muted-foreground text-sm">{media.caption}</p>
            )}
            <div className="grid gap-3 text-sm">
              {telegramType && (
                <div>
                  <span className="font-medium">Type: </span>
                  {telegramType.charAt(0).toUpperCase() + telegramType.slice(1)}
                </div>
              )}
              {telegramTitle && (
                <div>
                  <span className="font-medium">Title: </span>
                  {telegramTitle}
                </div>
              )}
              {media.product_name && (
                <div>
                  <span className="font-medium">Product: </span>
                  {media.product_name}
                </div>
              )}
              {media.product_code && (
                <div>
                  <span className="font-medium">Code: </span>
                  #{media.product_code}
                </div>
              )}
              {media.purchase_order_uid && (
                <div>
                  <span className="font-medium">Purchase Order: </span>
                  {media.purchase_order_uid}
                </div>
              )}
              {media.quantity && (
                <div>
                  <span className="font-medium">Quantity: </span>
                  {media.quantity}
                </div>
              )}
              {media.vendor_uid && (
                <div>
                  <span className="font-medium">Vendor: </span>
                  {media.vendor_uid}
                </div>
              )}
              {media.purchase_date && (
                <div>
                  <span className="font-medium">Purchase Date: </span>
                  {new Date(media.purchase_date).toLocaleDateString()}
                </div>
              )}
              {media.notes && (
                <div>
                  <span className="font-medium">Notes: </span>
                  {media.notes}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-4">
              {media.message_url && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full"
                >
                  <a
                    href={media.message_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    View Message <MessageSquare className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {media.chat_url && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full"
                >
                  <a
                    href={media.chat_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    View Channel <Users className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                asChild
                className="w-full"
              >
                <a
                  href={mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  Open File <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaViewer;