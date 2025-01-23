import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";
import MediaGridFilters from "./MediaGridFilters";
import MediaGridContent from "./MediaGridContent";

interface QueryResult {
  id: string;
  file_id: string;
  file_unique_id: string;
  file_type: string;
  public_url: string | null;
  default_public_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  product_name: string | null;
  product_code: string | null;
  vendor_uid: string | null;
  purchase_date: string | null;
  notes: string | null;
  telegram_data: Record<string, any>;
  glide_data: Record<string, any>;
  media_metadata: Record<string, any>;
  analyzed_content: {
    text?: string;
    labels?: string[];
    objects?: string[];
  } | null;
  created_at: string;
  updated_at: string;
}

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedSort, setSelectedSort] = useState("created_desc");

  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      const [channelsResult, vendorsResult] = await Promise.all([
        supabase
          .from('telegram_media')
          .select('telegram_data')
          .not('telegram_data', 'is', null),
        supabase
          .from('telegram_media')
          .select('vendor_uid')
          .not('vendor_uid', 'is', null)
      ]);

      // Extract unique channel titles from telegram_data
      const channels = [...new Set(channelsResult.data?.map(item => {
        const data = item.telegram_data;
        return data?.chat?.title;
      }).filter(Boolean) || [])];
      
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
        // Use containment operator @> for JSONB query
        query = query.filter('telegram_data', 'cs', `{"chat":{"title":"${selectedChannel}"}}`);
      }

      if (selectedType !== "all") {
        query = query.eq('file_type', selectedType);
      }

      if (selectedVendor !== "all") {
        query = query.eq('vendor_uid', selectedVendor);
      }

      // Add sorting
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

      return (queryResult as QueryResult[]).map((item): MediaItem => ({
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
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
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