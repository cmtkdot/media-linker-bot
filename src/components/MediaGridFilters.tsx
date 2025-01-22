import { MediaSearchBarProps } from "@/types/media";
import MediaSearchBar from "./MediaSearchBar";

const MediaGridFilters = ({ 
  search,
  onSearchChange,
  view,
  onViewChange,
  selectedChannel,
  onChannelChange,
  selectedType,
  onTypeChange,
  selectedVendor,
  onVendorChange,
  channels,
  vendors
}: MediaSearchBarProps) => {
  return (
    <MediaSearchBar
      search={search}
      onSearchChange={onSearchChange}
      view={view}
      onViewChange={onViewChange}
      selectedChannel={selectedChannel}
      onChannelChange={onChannelChange}
      selectedType={selectedType}
      onTypeChange={onTypeChange}
      selectedVendor={selectedVendor}
      onVendorChange={onVendorChange}
      channels={channels}
      vendors={vendors}
    />
  );
};

export default MediaGridFilters;