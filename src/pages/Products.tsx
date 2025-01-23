import { Card } from "@/components/ui/card";
import { MediaItem } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import MediaViewer from "@/components/MediaViewer";
import MediaEditDialog from "@/components/MediaEditDialog";
import { useToast } from "@/components/ui/use-toast";
import ProductGroup from "@/components/ProductGroup";

const Products = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  const { data: products, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((item): MediaItem => {
        // Initialize analyzed_content with default values
        const analyzedContent = {
          text: '',
          labels: [],
          objects: []
        };

        // Parse analyzed_content if it exists and is an object
        if (item.analyzed_content && typeof item.analyzed_content === 'object') {
          const content = item.analyzed_content as Record<string, unknown>;
          analyzedContent.text = typeof content.text === 'string' ? content.text : '';
          analyzedContent.labels = Array.isArray(content.labels) ? content.labels : [];
          analyzedContent.objects = Array.isArray(content.objects) ? content.objects : [];
        }

        return {
          ...item,
          file_type: item.file_type as MediaItem['file_type'],
          telegram_data: item.telegram_data as Record<string, any>,
          analyzed_content: analyzedContent,
          glide_data: item.glide_data as Record<string, any>,
          media_metadata: item.media_metadata as Record<string, any>
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
      toast({
        title: "Changes saved",
        description: "The media item has been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes.",
        variant: "destructive",
      });
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

      <MediaViewer
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