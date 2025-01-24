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
  // Fallback image from Unsplash for when media URLs are missing
  const fallbackImage = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d";

  // Helper to get the most appropriate URL with improved quality for videos
  const getDisplayUrl = () => {
    if (item.file_type === 'video') {
      // First try to get the high-quality thumbnail from telegram_data
      if (item.telegram_data?.message_data?.video?.thumb?.file_id) {
        const thumbData = item.telegram_data.message_data.video.thumb;
        return `https://kzfamethztziwqiocbwz.supabase.co/storage/v1/object/public/media/${thumbData.file_unique_id}.jpg`;
      }
      // Then try the stored thumbnail
      if (item.thumbnail_url && item.thumbnail_url !== item.default_public_url) {
        return item.thumbnail_url;
      }
      // Finally fall back to default URLs
      return item.default_public_url || item.public_url || fallbackImage;
    }
    return item.public_url || item.default_public_url || fallbackImage;
  };

  // Log missing URLs for debugging
  if (!item.public_url && !item.default_public_url) {
    console.warn('Media item missing URLs:', {
      id: item.id,
      file_type: item.file_type,
      public_url: item.public_url,
      default_public_url: item.default_public_url,
      thumbnail_url: item.thumbnail_url,
      telegram_thumb: item.telegram_data?.message_data?.video?.thumb
    });
  }

  return (
    <Card className="group relative overflow-hidden">
      <CardContent className="p-0">
        <div className="relative aspect-square">
          {/* Media preview */}
          <div className="absolute inset-0 bg-gray-100">
            {item.file_type === 'video' ? (
              <div className="relative w-full h-full">
                <img
                  src={getDisplayUrl()}
                  alt={item.caption || 'Video thumbnail'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (img.src !== fallbackImage) {
                      img.src = fallbackImage;
                    }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <PlayCircle className="w-12 h-12 text-white opacity-75" />
                </div>
              </div>
            ) : (
              <img
                src={getDisplayUrl()}
                alt={item.caption || 'Media item'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src !== fallbackImage) {
                    img.src = fallbackImage;
                  }
                }}
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