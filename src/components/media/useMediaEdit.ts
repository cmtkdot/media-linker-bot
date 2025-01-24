import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MediaItem } from "@/types/media";

export const useMediaEdit = (onClose: () => void) => {
  const { toast } = useToast();
  const [deleteFromTelegram, setDeleteFromTelegram] = useState(false);
  const [deleteFromGlide, setDeleteFromGlide] = useState(false);

  const deleteFromTelegramChannel = async (messageId: number, chatId: number) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-telegram-message', {
        body: { messageId, chatId }
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

  const updateTelegramMessage = async (messageId: number, chatId: number, updates: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('update-telegram-message', {
        body: { messageId, chatId, updates }
      });

      if (error) throw error;
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

  return {
    deleteFromTelegram,
    setDeleteFromTelegram,
    deleteFromGlide,
    setDeleteFromGlide,
    deleteFromTelegramChannel,
    deleteFromGlideApp,
    updateTelegramMessage,
    toast
  };
};