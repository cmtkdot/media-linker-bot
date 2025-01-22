import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { MediaItem, SupabaseMediaItem } from "@/types/media";
import MediaGridFilters from "./MediaGridFilters";
import MediaGridContent from "./MediaGridContent";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
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
        file_type: item.file_type as MediaItem['file_type'],
        telegram_data: item.telegram_data as Record<string, any>,
        glide_data: item.glide_data as Record<string, any>,
        media_metadata: item.media_metadata as Record<string, any>,
        analyzed_content: item.analyzed_content ? {
          text: (item.analyzed_content as any).text as string,
          labels: (item.analyzed_content as any).labels as string[],
          objects: (item.analyzed_content as any).objects as string[]
        } : undefined
      }));
    }
  });

  return (
    <div className="space-y-4 px-4 py-4">
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
        channels={filterOptions?.channels || []}
        vendors={filterOptions?.vendors || []}
      />
      
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