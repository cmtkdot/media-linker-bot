import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FilterOptions = {
  channels: string[];
  vendors: string[];
};

export const useMediaFilters = () => {
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedSort, setSelectedSort] = useState("created_desc");

  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ['filter-options'],
    queryFn: async () => {
      // Get unique channels from message_media_data->telegram_data->chat->title
      const channelsResult = await supabase
        .from('telegram_media')
        .select('message_media_data')
        .not('message_media_data->telegram_data->chat->title', 'is', null);

      // Get unique vendors from message_media_data->analysis->vendor_uid
      const vendorsResult = await supabase
        .from('telegram_media')
        .select('message_media_data')
        .not('message_media_data->analysis->vendor_uid', 'is', null);

      const channels = [...new Set(channelsResult.data?.map(item => {
        const messageData = item.message_media_data as Record<string, any>;
        return messageData?.telegram_data?.chat?.title as string;
      }).filter(Boolean) || [])];
      
      const vendors = [...new Set(vendorsResult.data?.map(item => {
        const messageData = item.message_media_data as Record<string, any>;
        return messageData?.analysis?.vendor_uid as string;
      }).filter(Boolean) || [])];

      return { channels, vendors };
    }
  });

  return {
    search,
    setSearch,
    selectedChannel,
    setSelectedChannel,
    selectedType,
    setSelectedType,
    selectedVendor,
    setSelectedVendor,
    selectedSort,
    setSelectedSort,
    filterOptions
  };
};