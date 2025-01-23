import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  onItemChange: (field: keyof MediaItem, value: any) => void;
  formatDate: (date: string | null) => string | null;
}

const MediaEditDialog = ({ editItem, onClose, onSave, onItemChange, formatDate }: MediaEditDialogProps) => {
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Media</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="caption" className="text-right">
              Caption
            </Label>
            <Input
              id="caption"
              value={editItem.caption || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('caption', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product_name" className="text-right">
              Product Name
            </Label>
            <Input
              id="product_name"
              value={editItem.product_name || ''}
              className="col-span-3"
              onChange={(e) => {
                onItemChange('product_name', e.target.value);
                if (editItem.analyzed_content?.text === editItem.caption) {
                  const updatedItem = { ...editItem, product_name: e.target.value };
                  onItemChange('caption', generateCaption(updatedItem));
                }
              }}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="product_code" className="text-right">
              Product Code
            </Label>
            <Input
              id="product_code"
              value={editItem.product_code || ''}
              className="col-span-3"
              onChange={(e) => {
                onItemChange('product_code', e.target.value);
                if (editItem.analyzed_content?.text === editItem.caption) {
                  const updatedItem = { ...editItem, product_code: e.target.value };
                  onItemChange('caption', generateCaption(updatedItem));
                }
              }}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">
              Quantity
            </Label>
            <Input
              id="quantity"
              type="number"
              value={editItem.quantity || ''}
              className="col-span-3"
              onChange={(e) => {
                onItemChange('quantity', parseInt(e.target.value) || null);
                if (editItem.analyzed_content?.text === editItem.caption) {
                  const updatedItem = { ...editItem, quantity: parseInt(e.target.value) || null };
                  onItemChange('caption', generateCaption(updatedItem));
                }
              }}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="vendor_uid" className="text-right">
              Vendor UID
            </Label>
            <Input
              id="vendor_uid"
              value={editItem.vendor_uid || ''}
              className="col-span-3"
              onChange={(e) => {
                onItemChange('vendor_uid', e.target.value);
                if (editItem.analyzed_content?.text === editItem.caption) {
                  const updatedItem = { ...editItem, vendor_uid: e.target.value };
                  onItemChange('caption', generateCaption(updatedItem));
                }
              }}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="purchase_date" className="text-right">
              Purchase Date
            </Label>
            <Input
              id="purchase_date"
              type="date"
              value={formatDate(editItem.purchase_date) || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('purchase_date', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="notes" className="text-right">
              Notes
            </Label>
            <Input
              id="notes"
              value={editItem.notes || ''}
              className="col-span-3"
              onChange={(e) => onItemChange('notes', e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            <Trash className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaEditDialog;