import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { ContentCard } from "@/components/ui/content-card";
import MediaTable from "./MediaTable";
import MediaViewer from "./MediaViewer";
import MediaSearchBar from "./MediaSearchBar";
import MediaEditDialog from "./MediaEditDialog";
import { MediaItem } from "@/types/media";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

interface TelegramData {
  chat: {
    id?: number;
    type?: string;
    title?: string;
  };
  message_id?: number;
  chat_id?: number;
  storage_path?: string;
  media_group_id?: string;
  date?: number;
}

interface FilterOptions {
  channels: string[];
  vendors: string[];
}

interface TelegramMediaResponse {
  telegram_data: TelegramData;
}

type MediaItemValue = string | number | null | undefined;

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const { toast } = useToast();

  const { data: filterOptions } = useQuery<FilterOptions>({
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

      const channels = [...new Set((channelsResult.data || [])
        .map(item => {
          const response = item as unknown as TelegramMediaResponse;
          return response.telegram_data.chat?.title;
        })
        .filter(Boolean))];
      
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

      // Group media by media_group_id if it exists
      const groupedData = (data || []).reduce((acc: { [key: string]: MediaItem[] }, item: MediaItem) => {
        const groupId = item.telegram_data?.media_group_id || item.id;
        if (!acc[groupId]) {
          acc[groupId] = [];
        }
        acc[groupId].push(item);
        return acc;
      }, {});

      // Return first item from each group
      return Object.values(groupedData).map(group => group[0]);
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

  const handleItemChange = (field: keyof MediaItem, value: MediaItemValue) => {
    setEditItem(prev => prev ? {...prev, [field]: value} : null);
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

  return (
    <div className="space-y-4 px-4 py-6 max-w-[2000px] mx-auto">
      <MediaSearchBar
        search={search}
        view={view}
        onSearchChange={setSearch}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {mediaItems.map((item) => (
            <ContentCard
              key={item.id}
              backgroundImage={item.thumbnail_url || item.public_url || item.default_public_url}
              onEdit={() => setEditItem(item)}
              onClick={() => setPreviewItem(item)}
              content={{
                channelTitle: item.telegram_data?.chat?.title,
                purchaseDate: item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : undefined,
                productName: item.product_name || 'Untitled Product',
                caption: item.caption
              }}
              isVideo={item.file_type === 'video'}
              className="group-hover/card:shadow-2xl transition-all duration-300"
            />
          ))}
        </div>
      ) : (
        <MediaTable 
          data={mediaItems} 
          onEdit={setEditItem} 
        />
      )}

      <MediaEditDialog
        editItem={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleEdit}
        onItemChange={handleItemChange}
        formatDate={(dateString) => dateString ? new Date(dateString).toISOString().split('T')[0] : null}
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