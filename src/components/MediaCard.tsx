import React from "react";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import { MediaItem } from "@/types/media";
import MediaActions from "./MediaActions";
import { useSupabaseClient } from "@supabase/auth-helpers-react";

interface MediaCardProps {
  item: MediaItem;
  onPreview: () => void;
  onEdit: (item: MediaItem) => void;
}

const MediaCard = ({ item, onPreview, onEdit }: MediaCardProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [thumbnailError, setThumbnailError] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const supabase = useSupabaseClient();

  const getDisplayUrl = () => {
    if (item.file_type === 'video') {
      // If we already have a thumbnail URL and no error, use it
      if (item.thumbnail_url && !thumbnailError) {
        return item.thumbnail_url;
      }

      // Try to get thumbnail from Telegram metadata
      const videoData = item.telegram_data?.message_data?.video;
      if (videoData?.thumb?.file_unique_id) {
        const { data } = supabase
          .storage
          .from('media')
          .getPublicUrl(`${videoData.thumb.file_unique_id}.jpg`);
        
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      }

      // Try other video metadata sources
      if (item.media_metadata?.thumbnail_path) {
        const { data } = supabase
          .storage
          .from('media')
          .getPublicUrl(item.media_metadata.thumbnail_path);
        
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      }

      // Final fallback chain
      return item.public_url || item.default_public_url;
    }

    // For non-video items
    return item.public_url || item.default_public_url;
  };

  const handleThumbnailError = () => {
    setThumbnailError(true);
    // If thumbnail fails, try to generate one from the video
    if (videoRef.current) {
      generateThumbnail();
    }
  };

  const generateThumbnail = async () => {
    if (!videoRef.current || !item.id) return;

    try {
      // Load the video
      videoRef.current.src = item.public_url || item.default_public_url;
      videoRef.current.currentTime = 1; // Seek to 1 second

      // Wait for the video to be ready
      await new Promise((resolve) => {
        videoRef.current!.addEventListener('seeked', resolve, { once: true });
      });

      // Create a canvas and draw the video frame
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
      });

      // Upload to Supabase
      const filename = `thumbnails/${item.id}.jpg`;
      const { error: uploadError } = await supabase
        .storage
        .from('media')
        .upload(filename, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data } = supabase
        .storage
        .from('media')
        .getPublicUrl(filename);

      if (data?.publicUrl) {
        // Update the media item with new thumbnail
        const { error: updateError } = await supabase
          .from('telegram_media')
          .update({ thumbnail_url: data.publicUrl })
          .eq('id', item.id);

        if (updateError) throw updateError;

        setThumbnailError(false);
      }
    } catch (error) {
      console.error('Error generating thumbnail:', error);
    }
  };

  const handleMouseEnter = async () => {
    if (item.file_type === 'video' && videoRef.current) {
      try {
        videoRef.current.src = item.public_url || item.default_public_url;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          await playPromise;
          setIsPlaying(true);
        }
      } catch (error) {
        console.error("Video playback error:", error);
      }
    }
  };

  const handleMouseLeave = () => {
    if (item.file_type === 'video' && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  return (
    <Card 
      className="group relative overflow-hidden bg-card hover:shadow-lg transition-all duration-300 rounded-xl border-0 cursor-pointer" 
      onClick={onPreview}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Media Section - Fixed aspect ratio container */}
      <div className="relative aspect-square w-full">
        {item.file_type === 'video' ? (
          <>
            <img
              src={getDisplayUrl()}
              alt={item.caption || "Video thumbnail"}
              className={`absolute inset-0 w-full h-full object-cover ${isPlaying ? 'hidden' : 'block'}`}
              onError={handleThumbnailError}
            />
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover ${isPlaying ? 'block' : 'hidden'}`}
              muted
              playsInline
              preload="none"
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="h-6 w-6 text-black" />
                </div>
              </div>
            )}
          </>
        ) : (
          <img
            src={getDisplayUrl()}
            alt={item.caption || "Media item"}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
      </div>

      {/* Info Section */}
      <div className="p-3 space-y-3">
        <div>
          <p className="font-medium text-foreground truncate">
            {item.product_name || 'Untitled Product'}
          </p>
          {item.caption && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {item.caption}
            </p>
          )}
          {item.product_code && (
            <p className="text-sm text-muted-foreground mt-1">
              Code: {item.product_code}
            </p>
          )}
        </div>
        
        <MediaActions 
          item={item}
          onEdit={() => onEdit(item)}
          onView={onPreview}
        />
      </div>
    </Card>
  );
};

export default MediaCard;