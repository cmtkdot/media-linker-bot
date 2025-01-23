import { Card } from "@/components/ui/card";
import { MediaItem, TelegramData, MediaMetadata } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import ProductMediaViewer from "@/components/ProductMediaViewer";
import MediaEditDialog from "@/components/MediaEditDialog";
import ProductGroup from "@/components/ProductGroup";

interface RawMediaItem {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url: string | null;
  default_public_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  product_name: string | null;
  product_code: string | null;
  quantity: number | null;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
  telegram_data: Record<string, unknown>;
  glide_data: Record<string, unknown> | null;
  media_metadata: Record<string, unknown> | null;
  analyzed_content: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const Products = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);

  const { data: products, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data as RawMediaItem[]).map((item): MediaItem => {
        // Initialize analyzed_content with default values
        const analyzedContent = {
          text: '',
          labels: [],
          objects: []
        };

        // Parse analyzed_content if it exists and is an object
        if (item.analyzed_content && typeof item.analyzed_content === 'object') {
          const content = item.analyzed_content;
          analyzedContent.text = typeof content.text === 'string' ? content.text : '';
          analyzedContent.labels = Array.isArray(content.labels) ? content.labels : [];
          analyzedContent.objects = Array.isArray(content.objects) ? content.objects : [];
        }

        // Ensure telegram_data matches TelegramData interface
        const telegramData = item.telegram_data;
        const validTelegramData: TelegramData = {
          message_id: Number(telegramData.message_id),
          chat_id: Number(telegramData.chat_id),
          chat: {
            id: Number(telegramData.chat?.id),
            title: String(telegramData.chat?.title || ''),
            type: String(telegramData.chat?.type || ''),
            username: String(telegramData.chat?.username || '')
          },
          date: Number(telegramData.date),
          caption: telegramData.caption as string | undefined,
          media_group_id: telegramData.media_group_id as string | undefined,
          message_data: telegramData.message_data as TelegramData['message_data'],
          storage_path: telegramData.storage_path as string | undefined
        };

        // Ensure media_metadata matches MediaMetadata interface
        const rawMetadata = item.media_metadata || {};
        const mediaMetadata: MediaMetadata = {
          width: typeof rawMetadata.width === 'number' ? rawMetadata.width : undefined,
          height: typeof rawMetadata.height === 'number' ? rawMetadata.height : undefined,
          duration: typeof rawMetadata.duration === 'number' ? rawMetadata.duration : undefined,
          thumbnail_path: typeof rawMetadata.thumbnail_path === 'string' ? rawMetadata.thumbnail_path : undefined,
          dimensions: typeof rawMetadata.dimensions === 'object' ? rawMetadata.dimensions as MediaMetadata['dimensions'] : undefined,
          thumbnail: typeof rawMetadata.thumbnail === 'object' ? rawMetadata.thumbnail as MediaMetadata['thumbnail'] : undefined
        };

        return {
          ...item,
          file_type: item.file_type as MediaItem['file_type'],
          telegram_data: validTelegramData,
          analyzed_content: analyzedContent,
          glide_data: item.glide_data || {},
          media_metadata: mediaMetadata
        };
      });
    }
  });

  const handleSave = async () => {
    if (!editItem) return;

    try {
      const { error } = await supabase
        .from('telegram_media')
        .update({
          caption: editItem.caption,
          product_name: editItem.product_name,
          product_code: editItem.product_code,
          quantity: editItem.quantity,
          vendor_uid: editItem.vendor_uid,
          purchase_date: editItem.purchase_date,
          notes: editItem.notes,
        })
        .eq('id', editItem.id);

      if (error) throw error;

      await refetch();
    } catch (error) {
      console.error('Error saving changes:', error);
    }
  };

  const groupMediaByProduct = (media: MediaItem[] | undefined) => {
    if (!media) return [];
    
    // Group by media_group_id or individual id
    const groups = media.reduce<Record<string, MediaItem[]>>((acc, item) => {
      const groupId = item.telegram_data?.media_group_id || item.id;
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(item);
      return acc;
    }, {});

    // Sort items within each group (photos first, then by creation date)
    return Object.values(groups).map(group => {
      return group.sort((a, b) => {
        if (a.file_type === 'photo' && b.file_type !== 'photo') return -1;
        if (a.file_type !== 'photo' && b.file_type === 'photo') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
  };

  const handleMediaClick = (media: MediaItem, group: MediaItem[]) => {
    setSelectedMedia(media);
    setViewerOpen(true);
  };

  const handleEdit = (item: MediaItem) => {
    setEditItem(item);
  };

  const productGroups = groupMediaByProduct(products);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Products Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {productGroups.map((group, index) => (
          <ProductGroup
            key={group[0].id}
            group={group}
            onMediaClick={handleMediaClick}
            onEdit={handleEdit}
          />
        ))}
      </div>

      <ProductMediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
        relatedMedia={selectedMedia ? productGroups.find(group => 
          group.some(item => item.id === selectedMedia.id)
        ) || [selectedMedia] : []}
      />

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleSave}
        onItemChange={(field, value) => {
          if (editItem) {
            setEditItem({ ...editItem, [field]: value });
          }
        }}
        formatDate={(date) => {
          if (!date) return null;
          return new Date(date).toISOString().split('T')[0];
        }}
      />
    </div>
  );
};

export default Products;