import { MediaSearchBarProps } from "@/types/filters";
import { useState } from "react";

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
    <div className="flex flex-col space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search..."
        className="p-2 border rounded"
      />
      <div className="flex space-x-2">
        <select value={view} onChange={(e) => onViewChange(e.target.value as 'grid' | 'table')} className="p-2 border rounded">
          <option value="grid">Grid View</option>
          <option value="table">Table View</option>
        </select>
        <select value={selectedChannel} onChange={(e) => onChannelChange(e.target.value)} className="p-2 border rounded">
          <option value="all">All Channels</option>
          {channels.map((channel) => (
            <option key={channel} value={channel}>{channel}</option>
          ))}
        </select>
        <select value={selectedType} onChange={(e) => onTypeChange(e.target.value)} className="p-2 border rounded">
          <option value="all">All Types</option>
          <option value="photo">Photo</option>
          <option value="video">Video</option>
          <option value="document">Document</option>
        </select>
        <select value={selectedVendor} onChange={(e) => onVendorChange(e.target.value)} className="p-2 border rounded">
          <option value="all">All Vendors</option>
          {vendors.map((vendor) => (
            <option key={vendor} value={vendor}>{vendor}</option>
          ))}
        </select>
        <select value={selectedSort} onChange={(e) => onSortChange(e.target.value)} className="p-2 border rounded">
          <option value="created_desc">Created (Newest First)</option>
          <option value="created_asc">Created (Oldest First)</option>
          <option value="name">Name</option>
          <option value="code">Code</option>
          <option value="vendor">Vendor</option>
        </select>
      </div>
    </div>
  );
};

export default MediaGridFilters;
