import React, { useState } from "react";
import { MediaItem } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import ProductGroup from "@/components/ProductGroup";
import MediaEditDialog from "@/components/MediaEditDialog";
import ProductMediaViewer from "@/components/ProductMediaViewer";
import { supabase } from "@/integrations/supabase/client";
import { getMediaCaption } from "@/utils/media-helpers";
import { useToast } from "@/components/ui/use-toast";

const Products = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  const { data: products = [], refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((item: any): MediaItem => ({
        ...item,
        file_type: item.file_type as MediaItem['file_type'],
        telegram_data: item.telegram_data || {},
        glide_data: item.glide_data || {},
        media_metadata: item.media_metadata || {},
        message_media_data: item.message_media_data || {
          message: {},
          sender: {},
          analysis: {},
          meta: {},
          media: {
            file_id: item.file_id,
            file_unique_id: item.file_unique_id,
            file_type: item.file_type,
            public_url: item.public_url,
            storage_path: item.storage_path
          }
        },
        analyzed_content: item.analyzed_content || {},
      }));
    }
  });

  const handleSave = async () => {
    if (!editItem) return;

    try {
      const { error } = await supabase
        .from('telegram_media')
        .update({
          message_media_data: {
            ...editItem.message_media_data,
            message: {
              ...editItem.message_media_data?.message,
              caption: getMediaCaption(editItem)
            },
            meta: {
              ...editItem.message_media_data?.meta,
              updated_at: new Date().toISOString()
            }
          },
          product_name: editItem.product_name,
          product_code: editItem.product_code,
          quantity: editItem.quantity,
          vendor_uid: editItem.vendor_uid,
          purchase_date: editItem.purchase_date,
          notes: editItem.notes,
          caption: getMediaCaption(editItem)
        })
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Media item updated successfully",
      });

      await refetch();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Error",
        description: "Failed to update media item",
        variant: "destructive",
      });
    }
  };

  const groupMediaByProduct = (media: MediaItem[]): MediaItem[][] => {
    if (!media?.length) return [];
    
    const groups = media.reduce<Record<string, MediaItem[]>>((acc, item) => {
      const groupId = item.telegram_data?.media_group_id || item.id;
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(item);
      return acc;
    }, {});

    return Object.values(groups).map(group => {
      return group.sort((a, b) => {
        if (a.file_type === 'photo' && b.file_type !== 'photo') return -1;
        if (a.file_type !== 'photo' && b.file_type === 'photo') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
  };

  const handleMediaClick = (media: MediaItem, group: MediaItem[]) => {
    if (media.message_media_data?.meta?.status === 'processing') {
      toast({
        title: "Processing",
        description: "This media item is still being processed",
      });
      return;
    }
    setSelectedMedia(media);
    setViewerOpen(true);
  };

  const handleEdit = (item: MediaItem) => {
    if (item.message_media_data?.meta?.status === 'processing') {
      toast({
        title: "Processing",
        description: "Cannot edit while media is being processed",
      });
      return;
    }
    setEditItem(item);
  };

  const productGroups = groupMediaByProduct(products);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Products Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {productGroups.map((group) => (
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
        relatedMedia={selectedMedia ? products.filter(item => 
          item.telegram_data?.media_group_id === selectedMedia.telegram_data?.media_group_id
        ) : []}
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