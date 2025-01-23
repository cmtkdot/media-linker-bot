import React from "react";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import { MediaItem } from "@/types/media";
import MediaActions from "./MediaActions";
import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { cn } from "@/lib/utils";

interface MediaCardProps {
  item: MediaItem;
  onPreview: () => void;
  onEdit: (item: MediaItem) => void;
}

const MediaCard = ({ item, onPreview, onEdit }: MediaCardProps) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [thumbnailError, setThumbnailError] = React.useState(false);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const supabase = useSupabaseClient();

  // Reset states when item changes
  React.useEffect(() => {
    setIsPlaying(false);
    setThumbnailError(false);
    setIsGeneratingThumbnail(false);
  }, [item.id]);

  const getDisplayUrl = () => {
    if (item.file_type === 'video') {
      // If we have a valid thumbnail URL and no error, use it
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
    if (videoRef.current && !isGeneratingThumbnail) {
      generateThumbnail();
    }
  };

  const generateThumbnail = async () => {
    if (!videoRef.current || !item.id || isGeneratingThumbnail) return;

    try {
      setIsGeneratingThumbnail(true);

      // Load the video
      videoRef.current.src = item.public_url || item.default_public_url;
      videoRef.current.currentTime = 1; // Skip to 1 second
      
      // Wait for video to load
      await new Promise((resolve, reject) => {
        const video = videoRef.current;
        if (!video) return reject('No video element');
        
        const handleLoad = () => {
          video.removeEventListener('loadeddata', handleLoad);
          video.removeEventListener('error', handleError);
          resolve(null);
        };
        
        const handleError = (e: Event) => {
          video.removeEventListener('loadeddata', handleLoad);
          video.removeEventListener('error', handleError);
          reject(e);
        };

        video.addEventListener('loadeddata', handleLoad);
        video.addEventListener('error', handleError);
      });

      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject('Failed to create blob'),
          'image/jpeg',
          0.95
        );
      });

      // Upload to Supabase
      const fileName = `thumb_${item.id}.jpg`;
      const { error: uploadError } = await supabase
        .storage
        .from('media')
        .upload(fileName, blob, {
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase
        .storage
        .from('media')
        .getPublicUrl(fileName);

      if (!data?.publicUrl) throw new Error('Failed to get public URL');

      // Update media record
      const { error: updateError } = await supabase
        .from('telegram_media')
        .update({ 
          thumbnail_url: data.publicUrl,
          media_metadata: {
            ...item.media_metadata,
            thumbnail_path: fileName
          }
        })
        .eq('id', item.id);

      if (updateError) throw updateError;

      // Reset error state since we have a new thumbnail
      setThumbnailError(false);

    } catch (error) {
      console.error('Error generating thumbnail:', error);
    } finally {
      setIsGeneratingThumbnail(false);
      if (videoRef.current) {
        videoRef.current.src = '';
      }
    }
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (!isPlaying) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <Card className="group relative overflow-hidden">
      <div className="relative aspect-square bg-muted">
        {/* Video Thumbnail */}
        {item.file_type === 'video' && !isPlaying && (
          <img
            src={getDisplayUrl()}
            alt={item.caption || 'Video thumbnail'}
            className="absolute inset-0 w-full h-full object-cover"
            onError={handleThumbnailError}
          />
        )}
        
        {/* Video Element */}
        {item.file_type === 'video' && (
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 w-full h-full object-cover",
              isPlaying ? "opacity-100" : "opacity-0"
            )}
            src={item.public_url}
            muted
            playsInline
            preload="none"
            onClick={handleVideoClick}
          />
        )}

        {/* Image */}
        {item.file_type !== 'video' && (
          <img
            src={getDisplayUrl()}
            alt={item.caption || ''}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Play Button Overlay */}
        {item.file_type === 'video' && !isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="h-6 w-6 text-black" />
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {isGeneratingThumbnail && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center animate-spin">
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full" />
            </div>
          </div>
        )}
      </div>

      <MediaActions item={item} onPreview={onPreview} onEdit={onEdit} />
    </Card>
  );
};

export default MediaCard;