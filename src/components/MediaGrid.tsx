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
}

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");

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

      const { data: queryResult, error: queryError } = await query;
      
      if (queryError) throw queryError;

      // Group media items by media_group_id
      const groupedItems = (queryResult as QueryResult[]).reduce((acc, item) => {
        const mediaGroupId = item.telegram_data?.media_group_id;
        if (!mediaGroupId) {
          acc.set(item.id, [item]);
          return acc;
        }

        const existingGroup = Array.from(acc.values()).find(group => 
          group[0].telegram_data?.media_group_id === mediaGroupId
        );

        if (existingGroup) {
          existingGroup.push(item);
        } else {
          acc.set(mediaGroupId, [item]);
        }
        return acc;
      }, new Map<string, QueryResult[]>());

      // Convert grouped items to MediaItem[] with related media
      return Array.from(groupedItems.values()).map(group => {
        const mainItem = group[0];
        return {
          ...mainItem,
          file_type: mainItem.file_type as MediaItem['file_type'],
          telegram_data: mainItem.telegram_data || {},
          glide_data: mainItem.glide_data || {},
          media_metadata: mainItem.media_metadata || {},
          analyzed_content: mainItem.analyzed_content ? {
            text: mainItem.analyzed_content.text || '',
            labels: mainItem.analyzed_content.labels || [],
            objects: mainItem.analyzed_content.objects || []
          } : undefined,
          related_media: group.slice(1).map(relatedItem => ({
            ...relatedItem,
            file_type: relatedItem.file_type as MediaItem['file_type'],
            telegram_data: relatedItem.telegram_data || {},
            glide_data: relatedItem.glide_data || {},
            media_metadata: relatedItem.media_metadata || {},
            analyzed_content: relatedItem.analyzed_content ? {
              text: relatedItem.analyzed_content.text || '',
              labels: relatedItem.analyzed_content.labels || [],
              objects: relatedItem.analyzed_content.objects || []
            } : undefined
          }))
        } as MediaItem;
      });
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