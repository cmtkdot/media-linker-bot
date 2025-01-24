import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import { MediaItem } from "@/types/media";
import { MediaEditForm } from "./media/MediaEditForm";
import { MediaDeleteConfirmation } from "./media/MediaDeleteConfirmation";
import { useMediaEdit } from "./media/useMediaEdit";
import { supabase } from "@/integrations/supabase/client";

interface MediaEditDialogProps {
  editItem: MediaItem | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  onItemChange: (field: keyof MediaItem, value: any) => void;
  formatDate: (date: string | null) => string | null;
}

const MediaEditDialog = ({ editItem, onClose, onSave, onItemChange, formatDate }: MediaEditDialogProps) => {
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const {
    deleteFromTelegram,
    setDeleteFromTelegram,
    deleteFromGlide,
    setDeleteFromGlide,
    deleteFromTelegramChannel,
    deleteFromGlideApp,
    updateTelegramMessage,
    toast
  } = useMediaEdit(onClose);

  const handleDelete = async () => {
    if (!editItem) return;

    try {
      if (deleteFromGlide && editItem.telegram_media_row_id) {
        await deleteFromGlideApp(editItem.telegram_media_row_id);
      }

      if (deleteFromTelegram && editItem.telegram_data?.message_id && editItem.telegram_data?.chat?.id) {
        await deleteFromTelegramChannel(
          editItem.telegram_data.message_id,
          editItem.telegram_data.chat.id
        );
      }

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

  const handleSave = async () => {
    if (!editItem) return;

    try {
      await onSave();

      if (editItem.telegram_data?.message_id && editItem.telegram_data?.chat?.id) {
        await updateTelegramMessage(
          editItem.telegram_data.message_id,
          editItem.telegram_data.chat.id,
          { caption: editItem.caption }
        );
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
          
          <MediaEditForm 
            editItem={editItem}
            onItemChange={onItemChange}
            formatDate={formatDate}
          />

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
        <MediaDeleteConfirmation
          editItem={editItem}
          deleteFromTelegram={deleteFromTelegram}
          deleteFromGlide={deleteFromGlide}
          onDeleteFromTelegramChange={setDeleteFromTelegram}
          onDeleteFromGlideChange={setDeleteFromGlide}
          onCancel={() => setShowDeleteAlert(false)}
          onConfirm={handleDelete}
        />
      </AlertDialog>
    </>
  );
};

export default MediaEditDialog;
