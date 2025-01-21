import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import MediaSearch from "./media/MediaSearch";
import MediaCard from "./media/MediaCard";
import MediaTable from "./MediaTable";
import MediaEditDialog from "./media/MediaEditDialog";
import { MediaItem } from "@/types/media";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mediaItems = [], isLoading, error } = useQuery({
    queryKey: ['telegram-media', search],
    queryFn: async () => {
      let query = supabase
        .from('telegram_media')
        .select('*');

      if (search) {
        query = query.or(`caption.ilike.%${search}%,product_name.ilike.%${search}%,product_code.ilike.%${search}%,vendor_uid.ilike.%${search}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching media:', error);
        throw error;
      }
      
      return (data || []) as MediaItem[];
    },
    retry: 3
  });

  const handleAnalyzeCaption = async () => {
    if (!editItem?.telegram_data?.media_group_id) return;
    
    setIsAnalyzing(true);
    try {
      const { data: response, error } = await supabase.functions.invoke('analyze-caption', {
        body: { 
          caption: editItem.caption,
          mediaGroupId: editItem.telegram_data.media_group_id
        }
      });

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
      
      toast({
        title: "Analysis complete",
        description: "Media group captions have been analyzed and updated.",
      });
    } catch (error) {
      console.error('Error analyzing captions:', error);
      toast({
        title: "Analysis failed",
        description: "Failed to analyze and update media group captions.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleEdit = async () => {
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
          purchase_date: editItem.purchase_date
        })
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "The media item has been updated successfully.",
      });

      setEditItem(null);
      queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
    } catch (error) {
      console.error('Error updating media:', error);
      toast({
        title: "Error",
        description: "Failed to update media item.",
        variant: "destructive",
      });
    }
  };

  const handleEditItemChange = (field: keyof MediaItem, value: any) => {
    setEditItem(prev => prev ? {...prev, [field]: value} : null);
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading media...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">Error loading media</div>;
  }

  if (!mediaItems?.length) {
    return <div className="text-center p-4">No media items found</div>;
  }

  return (
    <div className="space-y-4">
      <MediaSearch
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        onAnalyze={handleAnalyzeCaption}
        isAnalyzing={isAnalyzing}
        canAnalyze={!!editItem?.telegram_data?.media_group_id}
      />

      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaItems.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onClick={setEditItem}
            />
          ))}
        </div>
      ) : (
        <MediaTable data={mediaItems} onEdit={setEditItem} />
      )}

      <MediaEditDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleEdit}
        onChange={handleEditItemChange}
      />
    </div>
  );
};

export default MediaGrid;