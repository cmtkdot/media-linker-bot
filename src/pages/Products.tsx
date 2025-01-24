import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { MediaItem, ThumbnailSource } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import ProductGroup from "@/components/ProductGroup";
import MediaEditDialog from "@/components/MediaEditDialog";
import ProductMediaViewer from "@/components/ProductMediaViewer";
import { supabase } from "@/integrations/supabase/client";

const Products = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);

  const { data: products = [], refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((item: any): MediaItem => {
        const messageData = (item.telegram_data as Record<string, any>)?.message_data || {};
        return {
          ...item,
          file_type: item.file_type as MediaItem['file_type'],
          telegram_data: item.telegram_data as Record<string, any>,
          glide_data: item.glide_data as Record<string, any>,
          media_metadata: item.media_metadata as Record<string, any>,
          message_media_data: item.message_media_data as Record<string, any>,
          analyzed_content: item.analyzed_content as Record<string, any>,
          thumbnail_state: (item.thumbnail_state || 'pending') as MediaItem['thumbnail_state'],
          thumbnail_source: (item.thumbnail_source || 'default') as ThumbnailSource,
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