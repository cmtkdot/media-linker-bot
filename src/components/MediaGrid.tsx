import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";
import MediaGridFilters from "./MediaGridFilters";
import MediaGridContent from "./MediaGridContent";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { RefreshCw, Loader2 } from "lucide-react";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedSort, setSelectedSort] = useState("created_desc");
  const [isSyncing, setIsSyncing] = useState(false);
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
    queryKey: ['telegram-media', search, selectedChannel, selectedType, selectedVendor, selectedSort],
    queryFn: async () => {
      let query = supabase
        .from('telegram_media')
        .select('*');

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

      const [sortField, sortDirection] = selectedSort.split('_');
      switch (sortField) {
        case 'created':
          query = query.order('created_at', { ascending: sortDirection === 'asc' });
          break;
        case 'purchase':
          query = query.order('purchase_date', { ascending: sortDirection === 'asc' });
          break;
        case 'name':
          query = query.order('product_name', { ascending: sortDirection === 'asc' });
          break;
        case 'caption':
          query = query.order('caption', { ascending: sortDirection === 'asc' });
          break;
        case 'code':
          query = query.order('product_code', { ascending: sortDirection === 'asc' });
          break;
        case 'vendor':
          query = query.order('vendor_uid', { ascending: sortDirection === 'asc' });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data: queryResult, error: queryError } = await query;
      
      if (queryError) throw queryError;

      return (queryResult as any[]).map((item): MediaItem => ({
        ...item,
        file_type: item.file_type as MediaItem['file_type'],
        telegram_data: item.telegram_data || {},
        glide_data: item.glide_data || {},
        media_metadata: item.media_metadata || {},
        analyzed_content: item.analyzed_content ? {
          text: item.analyzed_content.text || '',
          labels: item.analyzed_content.labels || [],
          objects: item.analyzed_content.objects || []
        } : undefined,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));
    }
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-media-groups');

      if (error) throw error;

      await refetch();

      toast({
        title: "Media Groups Sync Complete",
        description: `Updated ${data.updated_groups} groups and synced ${data.synced_media} media items`,
      });
    } catch (error: any) {
      console.error('Error in media groups sync:', error);
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync media groups",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex justify-between items-center">
        <MediaGridFilters
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
          selectedSort={selectedSort}
          onSortChange={setSelectedSort}
          channels={filterOptions?.channels || []}
          vendors={filterOptions?.vendors || []}
        />
        <Button 
          onClick={handleSync}
          disabled={isSyncing}
          variant="outline"
          size="sm"
          className="ml-2"
        >
          {isSyncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Media Groups
            </>
          )}
        </Button>
      </div>
      
      <MediaGridContent
        items={mediaItems || []}
        view={view}
        isLoading={isLoading}
        error={error as Error | null}
        onMediaUpdate={refetch}
      />
    </div>
  );
};

export default MediaGrid;