import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { MediaItem } from "@/types/media";

interface MediaGridItemProps {
  item: MediaItem;
  onEdit: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  formatDate: (date: string | null) => string | null;
}

const MediaGridItem = ({ item, onEdit, onDelete, formatDate }: MediaGridItemProps) => {
  return (
    <Card key={item.id} className="overflow-hidden group relative">
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="destructive"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div 
        className="aspect-square relative cursor-pointer" 
        onClick={() => onEdit(item)}
      >
        {item.file_type === 'video' ? (
          <video 
            src={item.public_url}
            className="object-cover w-full h-full"
            controls
          />
        ) : (
          <img
            src={item.public_url || "/placeholder.svg"}
            alt={item.caption || "Media item"}
            className="object-cover w-full h-full"
          />
        )}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity p-4">
          <div className="text-white space-y-1">
            {item.caption && <p className="font-medium mb-2">{item.caption}</p>}
            {item.product_name && <p className="text-sm">{item.product_name}</p>}
            {item.product_code && <p className="text-sm">Code: #{item.product_code}</p>}
            {item.vendor_uid && <p className="text-sm">Vendor: {item.vendor_uid}</p>}
            {item.purchase_date && <p className="text-sm">Purchased: {formatDate(item.purchase_date)}</p>}
            {item.quantity && <p className="text-sm">Quantity: {item.quantity}</p>}
            {item.notes && <p className="text-sm">Notes: {item.notes}</p>}
          </div>
        </div>
      </div>
      <div className="p-2 space-y-1">
        <p className="font-medium truncate">{item.product_name || 'Untitled'}</p>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span className="capitalize">{item.file_type}</span>
          {item.vendor_uid && <span>Vendor: {item.vendor_uid}</span>}
        </div>
      </div>
    </Card>
  );
};

export default MediaGridItem;