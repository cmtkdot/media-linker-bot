import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FilterOptions {
  channels: string[];
  vendors: string[];
}

export const useMediaFilters = () => {
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedVendor, setSelectedVendor] = useState("all");
  const [selectedSort, setSelectedSort] = useState("created_desc");

  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ['filter-options'],
    queryFn: async () => {
      // Get unique channels from message_media_data->sender->chat_info->title
      const { data: channelsData } = await supabase
        .from('telegram_media')
        .select('message_media_data->sender->chat_info->title')
        .not('message_media_data->sender->chat_info->title', 'is', null);

      // Get unique vendors from message_media_data->analysis->vendor_uid
      const { data: vendorsData } = await supabase
        .from('telegram_media')
        .select('message_media_data->analysis->vendor_uid')
        .not('message_media_data->analysis->vendor_uid', 'is', null);

      // Extract unique values
      const channels = Array.from(new Set(
        channelsData
          ?.map(item => item.message_media_data?.sender?.chat_info?.title)
          .filter(Boolean) || []
      ));

      const vendors = Array.from(new Set(
        vendorsData
          ?.map(item => item.message_media_data?.analysis?.vendor_uid)
          .filter(Boolean) || []
      ));

      return {
        channels,
        vendors
      };
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
    filterOptions: filterOptions || { channels: [], vendors: [] }
  };
};