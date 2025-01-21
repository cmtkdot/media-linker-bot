import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

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
    telegram_data?: any;
  } | null;
}

const MediaViewer = ({ open, onOpenChange, media }: MediaViewerProps) => {
  if (!media) return null;

  const mediaUrl = media.public_url || media.default_public_url;
  const telegramData = media.telegram_data || {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-4">
        {media.caption && (
          <div className="text-center mb-6">
            <p className="text-xl font-medium">{media.caption}</p>
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Media Column */}
          <div className="flex-[1.5]">
            <div className="relative bg-black/5 rounded-lg overflow-hidden flex items-center justify-center" style={{ 
              height: '80vh',
              maxHeight: 'calc(100vh - 200px)',
              minHeight: '500px'
            }}>
              {media.file_type === "video" ? (
                <video
                  src={mediaUrl}
                  className="h-full w-full object-contain"
                  controls
                  autoPlay
                  onError={(e) => {
                    const video = e.target as HTMLVideoElement;
                    if (video.src !== media.default_public_url) {
                      video.src = media.default_public_url;
                    }
                  }}
                />
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
          <div className="flex-1 space-y-4">
            {/* Telegram Data */}
            <div className="bg-muted/30 p-4 rounded-lg space-y-2">
              <h3 className="font-medium text-lg mb-3">Telegram Information</h3>
              <div>
                <span className="font-medium">Type: </span>
                {telegramData.chat?.type || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Title: </span>
                {telegramData.chat?.title || 'N/A'}
              </div>
            </div>

            {/* Product Details */}
            <div className="grid gap-3">
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
            </div>
            <div className="pt-4">
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