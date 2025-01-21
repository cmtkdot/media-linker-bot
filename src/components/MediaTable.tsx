import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface MediaTableProps {
  data: any[];
  onEdit: (item: any) => void;
}

const MediaTable = ({ data, onEdit }: MediaTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleDelete = async (item: any) => {
    try {
      console.log('Deleting media item:', item);

      // First delete the file from storage if it exists
      if (item.telegram_data?.storage_path) {
        console.log('Deleting file from storage:', item.telegram_data.storage_path);
        const { error: storageError } = await supabase.storage
          .from('media')
          .remove([item.telegram_data.storage_path]);

        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
          throw storageError;
        }
      }

      // Delete the linked message if it exists
      if (item.message_id) {
        console.log('Deleting linked message:', item.message_id);
        const { error: messageError } = await supabase
          .from('messages')
          .delete()
          .eq('id', item.message_id);

        if (messageError) {
          console.error('Error deleting message:', messageError);
          throw messageError;
        }
      }

      // Finally delete the media record
      console.log('Deleting telegram_media record:', item.id);
      const { error: mediaError } = await supabase
        .from('telegram_media')
        .delete()
        .eq('id', item.id);

      if (mediaError) {
        console.error('Error deleting media:', mediaError);
        throw mediaError;
      }

      toast({
        title: "Media deleted",
        description: "The media item and associated data have been successfully deleted.",
      });

      queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
    } catch (error) {
      console.error('Error in delete operation:', error);
      toast({
        title: "Error",
        description: "Failed to delete media item and associated data.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Preview</TableHead>
            <TableHead>Caption</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Product Code</TableHead>
            <TableHead>Vendor UID</TableHead>
            <TableHead>Purchase Date</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.file_type === 'video' ? (
                  <video 
                    src={item.public_url}
                    className="w-16 h-16 object-cover rounded"
                  />
                ) : (
                  <img
                    src={item.public_url}
                    alt={item.caption || "Media"}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
              </TableCell>
              <TableCell>{item.caption || '-'}</TableCell>
              <TableCell>{item.product_name || '-'}</TableCell>
              <TableCell>{item.product_code || '-'}</TableCell>
              <TableCell>{item.vendor_uid || '-'}</TableCell>
              <TableCell>{formatDate(item.purchase_date)}</TableCell>
              <TableCell>{item.quantity || '-'}</TableCell>
              <TableCell className="capitalize">{item.file_type}</TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onEdit(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default MediaTable;