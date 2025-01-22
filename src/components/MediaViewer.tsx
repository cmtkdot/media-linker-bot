import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
    quantity?: number;
    vendor_uid?: string;
    purchase_date?: string;
    notes?: string;
  } | null;
}

const MediaViewer = ({ open, onOpenChange, media }: MediaViewerProps) => {
  if (!media) return null;

  const mediaUrl = media.public_url || media.default_public_url;

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
                <video
                  src={mediaUrl}
                  className="h-full w-full object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt={media.caption || "Media preview"}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
          </div>

          {/* Details Column */}
          <div className="flex-1 flex flex-col space-y-4">
            {media.caption && (
              <p className="text-muted-foreground text-sm">{media.caption}</p>
            )}
            <div className="grid gap-3 text-sm">
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaViewer;