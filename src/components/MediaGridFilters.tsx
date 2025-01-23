import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Grid, Table, Filter, SortAsc, SortDesc, Search, Tag, Video, Image } from "lucide-react";
import { MediaSearchBarProps } from "@/types/media";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

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
  selectedSort,
  onSortChange,
  channels,
  vendors,
}: MediaSearchBarProps) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search media..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 md:max-w-[300px]"
        />
        
        <DropdownMenu
          options={[
            { label: "All channels", onClick: () => onChannelChange("all") },
            ...channels.map(channel => ({
              label: channel,
              onClick: () => onChannelChange(channel)
            }))
          ]}
        >
          {selectedChannel === "all" ? "All channels" : selectedChannel}
        </DropdownMenu>

        <DropdownMenu
          options={[
            { label: "All types", onClick: () => onTypeChange("all"), Icon: <Filter className="h-4 w-4" /> },
            { label: "Photos", onClick: () => onTypeChange("photo"), Icon: <Image className="h-4 w-4" /> },
            { label: "Videos", onClick: () => onTypeChange("video"), Icon: <Video className="h-4 w-4" /> }
          ]}
        >
          {selectedType === "all" ? "All types" : selectedType}
        </DropdownMenu>

        <DropdownMenu
          options={[
            { label: "All vendors", onClick: () => onVendorChange("all"), Icon: <Tag className="h-4 w-4" /> },
            ...vendors.map(vendor => ({
              label: vendor,
              onClick: () => onVendorChange(vendor),
              Icon: <Tag className="h-4 w-4" />
            }))
          ]}
        >
          {selectedVendor === "all" ? "All vendors" : selectedVendor}
        </DropdownMenu>

        <DropdownMenu
          options={[
            { label: "Newest first", onClick: () => onSortChange("created_desc"), Icon: <SortDesc className="h-4 w-4" /> },
            { label: "Oldest first", onClick: () => onSortChange("created_asc"), Icon: <SortAsc className="h-4 w-4" /> },
            { label: "Purchase date (newest)", onClick: () => onSortChange("purchase_desc"), Icon: <SortDesc className="h-4 w-4" /> },
            { label: "Purchase date (oldest)", onClick: () => onSortChange("purchase_asc"), Icon: <SortAsc className="h-4 w-4" /> },
            { label: "Product name (A-Z)", onClick: () => onSortChange("name_asc"), Icon: <SortAsc className="h-4 w-4" /> },
            { label: "Product name (Z-A)", onClick: () => onSortChange("name_desc"), Icon: <SortDesc className="h-4 w-4" /> },
            { label: "Caption (A-Z)", onClick: () => onSortChange("caption_asc"), Icon: <SortAsc className="h-4 w-4" /> },
            { label: "Caption (Z-A)", onClick: () => onSortChange("caption_desc"), Icon: <SortDesc className="h-4 w-4" /> },
            { label: "Product code (A-Z)", onClick: () => onSortChange("code_asc"), Icon: <SortAsc className="h-4 w-4" /> },
            { label: "Product code (Z-A)", onClick: () => onSortChange("code_desc"), Icon: <SortDesc className="h-4 w-4" /> },
            { label: "Vendor (A-Z)", onClick: () => onSortChange("vendor_asc"), Icon: <SortAsc className="h-4 w-4" /> },
            { label: "Vendor (Z-A)", onClick: () => onSortChange("vendor_desc"), Icon: <SortDesc className="h-4 w-4" /> }
          ]}
        >
          Sort by
        </DropdownMenu>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant={view === 'grid' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onViewChange('grid')}
          className="h-9 w-9"
        >
          <Grid className="h-4 w-4" />
        </Button>
        <Button
          variant={view === 'table' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onViewChange('table')}
          className="h-9 w-9"
        >
          <Table className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MediaGridFilters;