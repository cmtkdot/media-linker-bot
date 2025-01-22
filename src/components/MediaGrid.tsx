import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import MediaTable from "./MediaTable";
import MediaViewer from "./MediaViewer";
import MediaSearchBar from "./MediaSearchBar";
import MediaEditDialog from "./MediaEditDialog";
import { MediaItem, SupabaseMediaItem, MediaFileType } from "@/types/media";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      const [channelsResult, vendorsResult] = await Promise.all([
        supabase
          .from('telegram_media')
          .select('telegram_data')
          .not('telegram_data->chat->title', 'is', null),
        supabase
          .from('telegram_media')
          .select('vendor_uid')
          .not('vendor_uid', 'is', null)
      ]);

      const channels = [...new Set(channelsResult.data?.map(item => 
        (item.telegram_data as any).chat?.title).filter(Boolean) || [])];
      
      const vendors = [...new Set(vendorsResult.data?.map(item => 
        item.vendor_uid).filter(Boolean) || [])];

      return { channels, vendors };
    }
  });

  const { data: mediaItems, isLoading, error, refetch } = useQuery<MediaItem[]>({
    queryKey: ['telegram-media', search, selectedChannel, selectedType, selectedVendor],
    queryFn: async () => {
      let query = supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`caption.ilike.%${search}%,product_name.ilike.%${search}%,product_code.ilike.%${search}%,vendor_uid.ilike.%${search}%`);
      }

      if (selectedChannel !== "all") {
        query = query.eq('telegram_data->>chat->>title', selectedChannel);
      }

      if (selectedType !== "all") {
        query = query.eq('file_type', selectedType);
      }

      if (selectedVendor !== "all") {
        query = query.eq('vendor_uid', selectedVendor);
      }

      const { data, error: queryError } = await query;
      if (queryError) throw queryError;

      return (data || []).map((item: SupabaseMediaItem): MediaItem => ({
        ...item,
        file_type: item.file_type as MediaFileType,
        telegram_data: item.telegram_data as any,
        analyzed_content: item.analyzed_content ? {
          text: item.analyzed_content.text as string,
          labels: item.analyzed_content.labels as string[],
          objects: item.analyzed_content.objects as string[]
        } : undefined
      }));
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telegram_media'
        },
        (payload) => {
          refetch();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading media...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading media</AlertTitle>
        <AlertDescription>{(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  if (!mediaItems?.length) {
    return (
      <Alert variant="default" className="m-4">
        <AlertDescription>No media items found</AlertDescription>
      </Alert>
    );
  }

  const formatDate = (date: string | null) => {
    if (!date) return null;
    return date.split('T')[0];
  };

  return (
    <div className="space-y-4 px-4 py-4">
      <MediaSearchBar 
        search={search}
        onSearchChange={setSearch}
        view={view}
        onViewChange={setView}
        selectedChannel={selectedChannel}
        onChannelChange={setSelectedChannel}
        selectedType={selectedType}
        onTypeChange={setSelectedType}
        selectedVendor={selectedVendor}
        onVendorChange={setSelectedVendor}
        channels={filterOptions?.channels || []}
        vendors={filterOptions?.vendors || []}
      />
      
      {view === 'grid' ? (
        <MediaViewer 
          open={!!previewItem}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          media={previewItem}
        />
      ) : (
        <MediaTable 
          data={mediaItems}
          onEdit={setEditItem}
        />
      )}

      <MediaEditDialog 
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onItemChange={(field, value) => setEditItem(prev => prev ? {...prev, [field]: value} : null)}
        onSave={handleEdit}
        formatDate={formatDate}
      />
    </div>
  );
};

export default MediaGrid;
