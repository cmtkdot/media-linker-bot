import { MediaSearchBarProps } from "@/types/media";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <Input
        placeholder="Search media..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full sm:w-64"
      />
      
      <Select value={selectedChannel} onValueChange={onChannelChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Select channel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All channels</SelectItem>
          {channels.map((channel) => (
            <SelectItem key={channel} value={channel}>{channel}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedType} onValueChange={onTypeChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Select type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          <SelectItem value="photo">Photos</SelectItem>
          <SelectItem value="video">Videos</SelectItem>
        </SelectContent>
      </Select>

      <Select value={selectedVendor} onValueChange={onVendorChange}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Select vendor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All vendors</SelectItem>
          {vendors.map((vendor) => (
            <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-2 ml-auto">
        <Button
          variant={view === 'grid' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onViewChange('grid')}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={view === 'table' ? 'default' : 'outline'}
          size="icon"
          onClick={() => onViewChange('table')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MediaGridFilters;