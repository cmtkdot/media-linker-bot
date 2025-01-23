import React from "react";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";
import MediaEditDialogContent from "./MediaEditDialogContent";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  onItemChange: (field: keyof MediaItem, value: any) => void;
  formatDate: (date: string | null) => string | null;
}

const MediaEditDialog = ({ editItem, onClose, onSave, onItemChange }: MediaEditDialogProps) => {
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!editItem) return;

    try {
      // First delete any related records in glide_sync_queue
      const { error: queueError } = await supabase
        .from('glide_sync_queue')
        .delete()
        .eq('record_id', editItem.id);

      if (queueError) throw queueError;

      // Then delete the media record
      const { error } = await supabase
        .from('telegram_media')
        .delete()
        .eq('id', editItem.id);

      if (error) throw error;

      toast({
        title: "Media deleted",
        description: "The media item has been deleted successfully.",
      });

      onClose();
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: "Error",
        description: "Failed to delete media item.",
        variant: "destructive",
      });
    }
  };

  const updateTelegramMessage = async (updates: any) => {
    if (!editItem?.telegram_data?.message_id || !editItem?.telegram_data?.chat?.id) {
      console.warn('Missing telegram data for update:', editItem);
      return;
    }

    // Only update Telegram if this media provided the original caption
    const isOriginalCaptionSource = editItem.analyzed_content?.text === editItem.caption;
    if (!isOriginalCaptionSource) {
      console.log('Skipping Telegram update - not the original caption source');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('update-telegram-message', {
        body: {
          messageId: editItem.telegram_data.message_id,
          chatId: editItem.telegram_data.chat.id,
          updates
        }
      });

      if (error) {
        console.error('Error updating Telegram message:', error);
        throw error;
      }

      console.log('Telegram message updated:', data);
    } catch (error) {
      console.error('Error updating Telegram message:', error);
      toast({
        title: "Warning",
        description: "Changes saved but failed to update Telegram message.",
        variant: "destructive",
      });
    }
  };

  const generateCaption = (item: MediaItem): string => {
    const parts = [];
    if (item.product_name) parts.push(item.product_name);
    if (item.product_code) parts.push(`#${item.product_code}`);
    if (item.quantity) parts.push(`x ${item.quantity}`);
    if (item.vendor_uid) parts.push(`(Vendor: ${item.vendor_uid})`);
    return parts.join(' ');
  };

  const handleSave = async () => {
    if (!editItem) return;

    try {
      // Update caption if this is the original caption source
      if (editItem.analyzed_content?.text === editItem.caption) {
        const newCaption = generateCaption(editItem);
        onItemChange('caption', newCaption);
      }

      // First save to Supabase
      await onSave();

      // Add to Glide sync queue
      const { error: queueError } = await supabase
        .from('glide_sync_queue')
        .insert({
          table_name: 'telegram_media',
          record_id: editItem.id,
          operation: 'UPDATE',
          new_data: editItem
        });

      if (queueError) throw queueError;

      // Then update Telegram message if needed
      if (editItem.telegram_data?.message_id && editItem.telegram_data?.chat?.id) {
        await updateTelegramMessage({
          caption: editItem.caption,
        });
      }

      toast({
        title: "Changes saved",
        description: "The media item has been updated successfully.",
      });

      onClose();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({
        title: "Error",
        description: "Failed to save changes.",
        variant: "destructive",
      });
    }
  };

  if (!editItem) return null;

  return (
    <Dialog open={!!editItem} onOpenChange={() => onClose()}>
      <MediaEditDialogContent
        editItem={editItem}
        onClose={onClose}
        onDelete={handleDelete}
        onSave={handleSave}
        onItemChange={onItemChange}
        generateCaption={generateCaption}
      />
    </Dialog>
  );
};

export default MediaEditDialog;