import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";
import { Checkbox } from "@/components/ui/checkbox";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  onItemChange: (field: keyof MediaItem, value: any) => void;
  formatDate: (date: string | null) => string | null;
}

const MediaEditDialog = ({ editItem, onClose, onSave, onItemChange, formatDate }: MediaEditDialogProps) => {
  const { toast } = useToast();
  const [deleteFromTelegram, setDeleteFromTelegram] = useState(false);
  const [deleteFromGlide, setDeleteFromGlide] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  const deleteFromTelegramChannel = async (messageId: number, chatId: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-telegram-message', {
        body: {
          messageId,
          chatId
        }
      });

      if (error) throw error;
      console.log('Successfully deleted from Telegram:', data);
      return true;
    } catch (error) {
      console.error('Error deleting from Telegram:', error);
      throw error;
    }
  };

  const deleteFromGlideApp = async (telegramMediaRowId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-glide-media-table', {
        body: { 
          operation: 'delete',
          rowId: telegramMediaRowId
        }
      });

      if (error) throw error;
      console.log('Successfully deleted from Glide:', data);
      return true;
    } catch (error) {
      console.error('Error deleting from Glide:', error);
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!editItem) return;

    try {
      // Step 1: Delete from Glide if selected and row ID exists
      if (deleteFromGlide && editItem.telegram_media_row_id) {
        await deleteFromGlideApp(editItem.telegram_media_row_id);
      }

      // Step 2: Delete from Telegram if selected
      if (deleteFromTelegram && editItem.telegram_data?.message_id && editItem.telegram_data?.chat?.id) {
        await deleteFromTelegramChannel(
          editItem.telegram_data.message_id,
          editItem.telegram_data.chat.id
        );
      }

      // Step 3: Delete from Supabase
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
      console.error('Error in delete flow:', error);
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

  const handleSave = async () => {
    if (!editItem) return;

    try {
      // First save to Supabase
      await onSave();

      // Then update Telegram message if we have the required data
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
    <>
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
                onChange={(e) => onItemChange('product_name', e.target.value)}
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
                onChange={(e) => onItemChange('product_code', e.target.value)}
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
                onChange={(e) => onItemChange('quantity', parseInt(e.target.value) || null)}
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
                onChange={(e) => onItemChange('vendor_uid', e.target.value)}
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
              onClick={() => setShowDeleteAlert(true)}
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

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this media?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Select the additional actions you want to perform:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col space-y-4 py-4">
            {editItem.telegram_media_row_id && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deleteFromGlide"
                  checked={deleteFromGlide}
                  onCheckedChange={(checked) => setDeleteFromGlide(checked as boolean)}
                />
                <Label htmlFor="deleteFromGlide">
                  Also delete from Glide app
                </Label>
              </div>
            )}
            {editItem.telegram_data?.message_id && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="deleteFromTelegram"
                  checked={deleteFromTelegram}
                  onCheckedChange={(checked) => setDeleteFromTelegram(checked as boolean)}
                />
                <Label htmlFor="deleteFromTelegram">
                  Also delete from Telegram channel
                </Label>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteAlert(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MediaEditDialog;
