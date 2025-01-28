import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MediaItem } from "@/types/media";
import { ChevronLeft, ChevronRight, PlayCircle, Edit } from "lucide-react";
import { format } from "date-fns";
import { getMediaCaption, getProductInfo } from "@/utils/media-helpers";

interface ProductGroupProps {
  group: MediaItem[];
  onMediaClick: (media: MediaItem, group: MediaItem[]) => void;
  onEdit: (item: MediaItem) => void;
}

const ProductGroup = ({ group, onMediaClick, onEdit }: ProductGroupProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const mainProduct = group[0];
  const hasMultipleMedia = group.length > 1;
  const productInfo = getProductInfo(mainProduct);

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : group.length - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev < group.length - 1 ? prev + 1 : 0));
  };

  return (
    <Card className="overflow-hidden group">
      <CardContent className="p-0">
        <div className="relative aspect-square">
          {group[currentIndex].file_type === 'video' ? (
            <div 
              className="relative w-full h-full cursor-pointer" 
              onClick={() => onMediaClick(group[currentIndex], group)}
            >
              <img
                src={group[currentIndex].public_url}
                alt={getMediaCaption(group[currentIndex]) || ''}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <PlayCircle className="w-12 h-12 text-white opacity-75" />
              </div>
            </div>
          ) : (
            <img
              src={group[currentIndex].public_url}
              alt={getMediaCaption(group[currentIndex]) || ''}
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => onMediaClick(group[currentIndex], group)}
            />
          )}

          {hasMultipleMedia && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs">
                {currentIndex + 1} / {group.length}
              </div>
            </>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(group[currentIndex]);
            }}
            className="absolute top-2 left-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
      <CardHeader className="space-y-4">
        <CardTitle className="text-2xl font-bold">
          {productInfo.name || "Untitled Product"}
        </CardTitle>
        {getMediaCaption(mainProduct) && (
          <p className="text-lg text-muted-foreground mt-4">
            {getMediaCaption(mainProduct)}
          </p>
        )}
        {productInfo.code && (
          <p className="text-sm font-medium text-sky-500 dark:text-sky-400">
            Product Code: {productInfo.code}
          </p>
        )}
        {productInfo.quantity && (
          <p className="text-sm text-muted-foreground">
            Quantity: {productInfo.quantity}
          </p>
        )}
        {productInfo.vendor && (
          <p className="text-sm text-muted-foreground">
            Vendor: {productInfo.vendor}
          </p>
        )}
        {productInfo.purchaseDate && (
          <p className="text-sm text-muted-foreground">
            Purchase Date: {format(new Date(productInfo.purchaseDate), "MM/dd/yyyy")}
          </p>
        )}
        {productInfo.notes && (
          <p className="text-sm text-muted-foreground">
            Notes: {productInfo.notes}
          </p>
        )}
      </CardHeader>
    </Card>
  );
};

export default ProductGroup;