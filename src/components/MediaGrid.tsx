import { useState } from "react";
import MediaGridFilters from "./MediaGridFilters";
import MediaGridContent from "./MediaGridContent";
import MediaTable from "./MediaTable";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Brain } from "lucide-react";
import { useMediaFilters } from "@/hooks/useMediaFilters";
import { useMediaData } from "@/hooks/useMediaData";
import { useMediaActions } from "@/hooks/useMediaActions";
import { MediaItem } from "@/types/media";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  
  const {
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
  } = useMediaFilters();

  const { 
    data: mediaItems, 
    isLoading, 
    error, 
    refetch 
  } = useMediaData(
    search,
    selectedChannel,
    selectedType,
    selectedVendor,
    selectedSort
  );

  const {
    isSyncing,
    isAnalyzing,
    handleSync,
    handleAnalyzeCaptions
  } = useMediaActions(refetch);

  // Process media items to ensure proper media handling
  const processedMediaItems = mediaItems?.map(item => {
    if (item.file_type === 'video' && item.telegram_data?.media_group_id) {
      // Find associated photo in the same media group
      const mediaGroupPhoto = mediaItems.find(media => 
        media.file_type === 'photo' && 
        media.telegram_data?.media_group_id === item.telegram_data?.media_group_id
      );
      if (mediaGroupPhoto) {
        return {
          ...item,
          public_url: mediaGroupPhoto.public_url || item.public_url
        };
      }
    }
    return item;
  }) || [];

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex justify-between items-center">
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
        <div className="flex gap-2">
          <Button 
            onClick={handleAnalyzeCaptions}
            disabled={isAnalyzing}
            variant="outline"
            size="sm"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Analyze Captions
              </>
            )}
          </Button>
          <Button 
            onClick={handleSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync Media Groups
              </>
            )}
          </Button>
        </div>
      </div>
      
      {view === 'table' ? (
        <MediaTable
          data={processedMediaItems}
          onEdit={(item) => {
            console.log('Edit item:', item);
          }}
        />
      ) : (
        <MediaGridContent
          items={processedMediaItems}
          view={view}
          isLoading={isLoading}
          error={error as Error | null}
          onMediaUpdate={refetch}
        />
      )}
    </div>
  );
};

export default MediaGrid;