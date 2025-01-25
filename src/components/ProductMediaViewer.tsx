import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { MediaItem } from "@/types/media";
import { getMediaCaption } from "@/utils/media-helpers";

interface ProductMediaViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  relatedMedia?: MediaItem[];
}

const ProductMediaViewer = ({ 
  open, 
  onOpenChange, 
  media,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  relatedMedia = []
}: ProductMediaViewerProps) => {
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
          <div className="flex-[1.5] min-h-0 relative">
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
                  alt={getMediaCaption(media) || "Media preview"}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            
            {/* Navigation Buttons */}
            <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none">
              {hasPrevious && (
                <Button
                  onClick={onPrevious}
                  className="relative ps-12 ml-4 pointer-events-auto"
                  variant="secondary"
                >
                  Previous
                  <span className="pointer-events-none absolute inset-y-0 start-0 flex w-9 items-center justify-center bg-primary-foreground/15">
                    <ChevronLeft className="opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
                  </span>
                </Button>
              )}
              {hasNext && (
                <Button
                  onClick={onNext}
                  className="relative pe-12 mr-4 pointer-events-auto"
                  variant="secondary"
                >
                  Next
                  <span className="pointer-events-none absolute inset-y-0 end-0 flex w-9 items-center justify-center bg-primary-foreground/15">
                    <ChevronRight className="opacity-60" size={16} strokeWidth={2} aria-hidden="true" />
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Details Column */}
          <div className="flex-1 flex flex-col space-y-4">
            {getMediaCaption(media) && (
              <p className="text-muted-foreground text-sm">{getMediaCaption(media)}</p>
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

export default ProductMediaViewer;