import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Grid, Table } from "lucide-react";
import { MediaSearchBarProps } from "@/types/media";

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
        <Select value={selectedChannel} onValueChange={onChannelChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Select channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All channels</SelectItem>
            {channels.map((channel) => (
              <SelectItem key={channel} value={channel}>
                {channel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedType} onValueChange={onTypeChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="photo">Photos</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedVendor} onValueChange={onVendorChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Select vendor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All vendors</SelectItem>
            {vendors.map((vendor) => (
              <SelectItem key={vendor} value={vendor}>
                {vendor}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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