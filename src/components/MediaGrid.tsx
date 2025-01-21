import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import MediaSearch from "./media/MediaSearch";
import MediaViewToggle from "./media/MediaViewToggle";
import MediaGridView from "./media/MediaGridView";
import MediaTable from "./MediaTable";
import MediaEditDialog from "./media/MediaEditDialog";
import { MediaItem } from "./media/types";

const MediaGrid = () => {
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState("");
  const [editItem, setEditItem] = useState<MediaItem | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mediaItems, isLoading, error } = useQuery({
    queryKey: ['telegram-media', search],
    queryFn: async () => {
      let query = supabase
        .from('telegram_media')
        .select('*')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`caption.ilike.%${search}%,product_name.ilike.%${search}%,product_code.ilike.%${search}%,vendor_uid.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MediaItem[];
    }
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      type MediaGroupResult = { telegram_data: { media_group_id: string | null } }[];
      
      const { data: mediaGroups, error: groupsError } = await supabase
        .from('telegram_media')
        .select('telegram_data->media_group_id')
        .is('caption', null)
        .not('telegram_data->media_group_id', 'is', null);

      if (groupsError) throw groupsError;

      if (!mediaGroups?.length) {
        toast({
          title: "No media groups to sync",
          description: "All media groups have captions.",
        });
        return;
      }

      // Filter unique media group IDs
      const uniqueGroups = mediaGroups.reduce((acc: string[], item: any) => {
        const groupId = item.media_group_id;
        if (groupId && !acc.includes(groupId)) {
          acc.push(groupId);
        }
        return acc;
      }, []);

      if (!uniqueGroups.length) {
        toast({
          title: "No media groups to sync",
          description: "All media groups have captions.",
        });
        return;
      }

      // Sync each media group
      for (const groupId of uniqueGroups) {
        const { data: firstItem, error: itemError } = await supabase
          .from('telegram_media')
          .select('id')
          .eq('telegram_data->media_group_id', groupId)
          .maybeSingle();

        if (itemError) {
          console.error('Error finding media item:', itemError);
          continue;
        }

        if (firstItem) {
          const { error: syncError } = await supabase
            .rpc('sync_media_group_info_rpc', { 
              media_id: firstItem.id 
            });

          if (syncError) {
            console.error('Error syncing media group:', groupId, syncError);
            continue;
          }
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
      
      toast({
        title: "Sync successful",
        description: "Media group information has been synchronized.",
      });
    } catch (error) {
      console.error('Error syncing media:', error);
      toast({
        title: "Sync failed",
        description: "Failed to synchronize media group information.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEdit = async () => {
    if (!editItem) return;

    try {
      const { error } = await supabase
        .from('telegram_media')
        .update({
          caption: editItem.caption,
          product_name: editItem.product_name,
          product_code: editItem.product_code,
          quantity: editItem.quantity,
          vendor_uid: editItem.vendor_uid,
          purchase_date: editItem.purchase_date
        })
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Changes saved",
        description: "The media item has been updated successfully.",
      });

      setEditItem(null);
    } catch (error) {
      console.error('Error updating media:', error);
      toast({
        title: "Error",
        description: "Failed to update media item.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  if (isLoading) {
    return <div className="text-center p-4">Loading media...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 p-4">Error loading media</div>;
  }

  if (!mediaItems?.length) {
    return <div className="text-center p-4">No media items found</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <MediaSearch value={search} onChange={setSearch} />
        <MediaViewToggle
          view={view}
          onViewChange={setView}
          onSync={handleSync}
          isSyncing={isSyncing}
          canSync={true}
        />
      </div>

      {view === 'grid' ? (
        <MediaGridView items={mediaItems} onItemClick={setEditItem} />
      ) : (
        <MediaTable data={mediaItems} onEdit={setEditItem} />
      )}

      <MediaEditDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onSave={handleEdit}
        onChange={(field, value) => setEditItem(prev => prev ? {...prev, [field]: value} : null)}
        formatDate={formatDate}
      />
    </div>
  );
};

export default MediaGrid;