import { Card } from "@/components/ui/card";
import { MediaItem } from "@/types/media";

interface MediaCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
}

const MediaCard = ({ item, onClick }: MediaCardProps) => {
  return (
    <Card 
      key={item.id} 
      className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow" 
      onClick={() => onClick(item)}
    >
      <div className="aspect-square relative">
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
          <div className="text-white">
            {item.caption && <p className="font-medium mb-2">{item.caption}</p>}
            {item.product_name && <p className="text-sm">{item.product_name}</p>}
            {item.product_code && <p className="text-sm">#{item.product_code}</p>}
            {item.vendor_uid && <p className="text-sm">Vendor: {item.vendor_uid}</p>}
            {item.purchase_date && <p className="text-sm">Purchased: {new Date(item.purchase_date).toLocaleDateString()}</p>}
            {item.quantity && <p className="text-sm">Quantity: {item.quantity}</p>}
          </div>
        </div>
      </div>
      <div className="p-2 text-sm">
        <p className="font-medium truncate">{item.product_name || 'Untitled'}</p>
        <p className="text-muted-foreground capitalize">{item.file_type}</p>
      </div>
    </Card>
  );
};

export default MediaCard;