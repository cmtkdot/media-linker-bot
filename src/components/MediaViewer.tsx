import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  } | null;
}

const MediaViewer = ({ open, onOpenChange, media }: MediaViewerProps) => {
  if (!media) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-4">
        <DialogHeader className="w-full">
          <DialogTitle className="text-right">{media.product_name || "Media Preview"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Media Column */}
          <div className="flex-[1.5]">
            <div className="relative aspect-[3/4] bg-black/5 rounded-lg overflow-hidden">
              {media.file_type === "video" ? (
                <video
                  src={media.public_url}
                  className="w-full h-full object-contain"
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
                  src={media.public_url}
                  alt={media.caption || "Media preview"}
                  className="w-full h-full object-contain"
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
            {media.caption && (
              <p className="text-muted-foreground">{media.caption}</p>
            )}
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
                  href={media.public_url || media.default_public_url}
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