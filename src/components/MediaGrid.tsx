import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import MediaCard from "./MediaCard";
import MediaTable from "./MediaTable";
import MediaViewer from "./MediaViewer";
import MediaSearchBar from "./MediaSearchBar";
import MediaEditDialog from "./MediaEditDialog";
import { MediaItem } from "@/types/media";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  const { data: mediaItems, isLoading, error, refetch } = useQuery({
    queryKey: ['telegram-media', search],
    queryFn: async () => {
      try {
        let query = supabase
          .from('telegram_media')
          .select('*')
          .order('created_at', { ascending: false });

        if (search) {
          query = query.or(`caption.ilike.%${search}%,product_name.ilike.%${search}%,product_code.ilike.%${search}%,vendor_uid.ilike.%${search}%`);
        }

        const { data, error: queryError } = await query;
        
        if (queryError) {
          console.error('Supabase query error:', queryError);
          throw queryError;
        }
        
        if (!data) {
          console.warn('No data returned from Supabase');
          return [];
        }

        return data as MediaItem[];
      } catch (err) {
        console.error('Error fetching media:', err);
        throw err;
      }
    },
    retry: 1
  });

  // Subscribe to real-time changes
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'telegram_media'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          // Refetch data when changes occur
          refetch();
          
          // Show toast notification for changes
          const eventMessages = {
            INSERT: 'New media item added',
            UPDATE: 'Media item updated',
            DELETE: 'Media item deleted'
          };
          
          toast({
            title: eventMessages[payload.eventType as keyof typeof eventMessages],
            description: "The media list has been updated.",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, toast]);

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
    } catch (error) {
      console.error('Error updating media:', error);
      toast({
        title: "Error",
        description: "Failed to update media item.",
        variant: "destructive",
      });
    }
  };

  const handleItemChange = (field: keyof MediaItem, value: any) => {
    setEditItem(prev => prev ? {...prev, [field]: value} : null);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading media...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">Error loading media: {error.message}</div>;
  }

  if (!mediaItems?.length) {
    return <div className="text-center p-4">No media items found</div>;
  }

  return (
    <div className="space-y-4 px-2 sm:px-4">
      <MediaSearchBar
        search={search}
        view={view}
        onSearchChange={setSearch}
        onViewChange={setView}
      />

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          {mediaItems.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onEdit={setEditItem}
              onPreview={setPreviewItem}
            />
          ))}
        </div>
      ) : (
        <MediaTable data={mediaItems} onEdit={setEditItem} />
      )}

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleEdit}
        onItemChange={handleItemChange}
        formatDate={formatDate}
      />

      <MediaViewer
        open={!!previewItem}
        onOpenChange={(open) => !open && setPreviewItem(null)}
        media={previewItem}
      />
    </div>
  );
};

export default MediaGrid;