import { MediaItem } from "@/types/media";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Eye, Edit } from "lucide-react";

interface MediaCardProps {
  item: MediaItem;
  onPreview: () => void;
  onEdit: (item: MediaItem) => void;
}

const MediaCard = ({ item, onPreview, onEdit }: MediaCardProps) => {
  return (
    <Card className="group relative overflow-hidden">
      <CardContent className="p-0">
        <div className="relative aspect-square">
          {/* Media preview */}
          <div className="absolute inset-0 bg-gray-100">
            {item.file_type === 'video' ? (
              <div className="relative w-full h-full">
                <img
                  src={item.thumbnail_url || item.default_public_url}
                  alt={item.caption || ''}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <PlayCircle className="w-12 h-12 text-white opacity-75" />
                </div>
              </div>
            ) : (
              <img
                src={item.public_url || item.default_public_url}
                alt={item.caption || ''}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute inset-0 flex items-center justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={onPreview}>
                <Eye className="w-4 h-4 mr-1" />
                View
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onEdit(item)}>
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
            </div>
          </div>
        </div>

        {/* Product Information */}
        <div className="p-4">
          <h3 className="font-medium text-sm mb-1">
            {item.product_name || 'Untitled Product'}
          </h3>
          {item.caption && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {item.caption}
            </p>
          )}
          {item.product_code && (
            <p className="text-sm text-muted-foreground mt-1">
              Code: {item.product_code}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MediaCard;