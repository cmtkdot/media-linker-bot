import React from "react";
import { AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MediaItem } from "@/types/media";

interface MediaDeleteConfirmationProps {
  editItem: MediaItem;
  deleteFromTelegram: boolean;
  deleteFromGlide: boolean;
  onDeleteFromTelegramChange: (checked: boolean) => void;
  onDeleteFromGlideChange: (checked: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const MediaDeleteConfirmation = ({
  editItem,
  deleteFromTelegram,
  deleteFromGlide,
  onDeleteFromTelegramChange,
  onDeleteFromGlideChange,
  onCancel,
  onConfirm
}: MediaDeleteConfirmationProps) => {
  return (
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
              onCheckedChange={(checked) => onDeleteFromGlideChange(checked as boolean)}
            />
            <Label htmlFor="deleteFromGlide">Also delete from Glide app</Label>
          </div>
        )}
        {editItem.telegram_data?.message_id && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="deleteFromTelegram"
              checked={deleteFromTelegram}
              onCheckedChange={(checked) => onDeleteFromTelegramChange(checked as boolean)}
            />
            <Label htmlFor="deleteFromTelegram">Also delete from Telegram channel</Label>
          </div>
        )}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
};