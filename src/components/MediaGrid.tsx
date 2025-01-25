import { useState, useCallback } from "react";
import MediaGridFilters from "./MediaGridFilters";
import MediaTable from "./MediaTable";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Brain } from "lucide-react";
import { useMediaFilters } from "@/hooks/useMediaFilters";
import { useMediaData } from "@/hooks/useMediaData";
import { useMediaActions } from "@/hooks/useMediaActions";
import { MediaItem } from "@/types/media";
import { InventoryViewer } from "./inventory/InventoryViewer";
import InventoryCard from "./inventory/InventoryCard";
import EditMediaDialog from "./inventory/EditMediaDialog";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  
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
  } = useMediaData();

  const {
    isSyncing,
    isAnalyzing,
    handleSync,
    handleAnalyzeCaptions
  } = useMediaActions(async () => {
    await refetch();
  });

  const handlePreview = useCallback((item: MediaItem) => {
    setSelectedItem(item);
  }, []);

  const handleEdit = useCallback((item: MediaItem) => {
    setEditItem(item);
  }, []);

  const handleEditComplete = useCallback(async (updatedItem: MediaItem) => {
    setEditItem(null);
    await refetch();
  }, [refetch]);

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
          data={mediaItems || []}
          onEdit={handleEdit}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(mediaItems || []).map((item) => (
              <InventoryCard
                key={item.id}
                item={item}
                onPreview={() => handlePreview(item)}
                onEdit={() => handleEdit(item)}
              />
            ))}
          </div>

          {selectedItem && (
            <InventoryViewer
              open={!!selectedItem}
              onOpenChange={(open) => !open && setSelectedItem(null)}
              media={selectedItem}
            />
          )}

          {editItem && (
            <EditMediaDialog
              open={!!editItem}
              onOpenChange={(open) => !open && setEditItem(null)}
              item={editItem}
              onSave={handleEditComplete}
            />
          )}
        </>
      )}
    </div>
  );
};

export default MediaGrid;