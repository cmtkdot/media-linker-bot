import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Grid, List } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import MediaTable from "./MediaTable";
import MediaGridItem from "./MediaGridItem";
import MediaEditDialog from "./MediaEditDialog";
import { MediaItem } from "@/types/media";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mediaItems, isLoading, error } = useQuery({
    queryKey: ['telegram-media', search],
    queryFn: async () => {
      let query = supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`caption.ilike.%${search}%,product_name.ilike.%${search}%,product_code.ilike.%${search}%,vendor_uid.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MediaItem[];
    }
  });

  const handleDelete = async (item: MediaItem) => {
    try {
      console.log('Deleting media item:', item);

      if (item.telegram_data?.storage_path) {
        console.log('Deleting file from storage:', item.telegram_data.storage_path);
        const { error: storageError } = await supabase.storage
          .from('media')
          .remove([item.telegram_data.storage_path]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
          throw storageError;
        }
      }

      if (item.message_id) {
        console.log('Deleting linked message:', item.message_id);
        const { error: messageError } = await supabase
          .from('messages')
          .delete()
          .eq('id', item.message_id);

        if (messageError) {
          console.error('Error deleting message:', messageError);
          throw messageError;
        }
      }

      console.log('Deleting telegram_media record:', item.id);
      const { error: mediaError } = await supabase
        .from('telegram_media')
        .delete()
        .eq('id', item.id);

      if (mediaError) {
        console.error('Error deleting media:', mediaError);
        throw mediaError;
      }

      toast({
        title: "Media deleted",
        description: "The media item and associated data have been successfully deleted.",
      });

      queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
    } catch (error) {
      console.error('Error in delete operation:', error);
      toast({
        title: "Error",
        description: "Failed to delete media item and associated data.",
        variant: "destructive",
      });
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
          purchase_date: editItem.purchase_date,
          notes: editItem.notes
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
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
      <div className="flex justify-between items-center">
        <Input
          className="max-w-sm"
          placeholder="Search by caption, product name, code, vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex space-x-2">
          <Button
            variant={view === 'grid' ? "default" : "outline"}
            size="icon"
            onClick={() => setView('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'table' ? "default" : "outline"}
            size="icon"
            onClick={() => setView('table')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mediaItems.map((item) => (
            <MediaGridItem
              key={item.id}
              item={item}
              onEdit={setEditItem}
              onDelete={handleDelete}
              formatDate={formatDate}
            />
          ))}
        </div>
      ) : (
        <MediaTable data={mediaItems} onEdit={setEditItem} />
      )}

      <MediaEditDialog
        editItem={editItem}
        setEditItem={setEditItem}
        onSave={handleEdit}
      />
    </div>
  );
};

export default MediaGrid;