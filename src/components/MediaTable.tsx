import React, { useState } from "react";
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
import MediaViewer from "./MediaViewer";

interface MediaTableProps {
  data: any[];
  onEdit: (item: any) => void;
}

const MediaTable = ({ data, onEdit }: MediaTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('telegram_media')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Media deleted",
        description: "The media item and associated data have been successfully deleted.",
      });

      queryClient.invalidateQueries({ queryKey: ['telegram-media'] });
    } catch (error) {
      console.error('Error deleting media:', error);
      toast({
        title: "Error",
        description: "Failed to delete media item and associated data.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const handleRowClick = (item: any) => {
    setSelectedMedia(item);
    setViewerOpen(true);
  };

  return (
    <>
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
              <TableRow 
                key={item.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(item)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {item.file_type === 'video' ? (
                    <video 
                      src={item.public_url}
                      className="w-16 h-16 object-cover rounded"
                      onError={(e) => {
                        const video = e.target as HTMLVideoElement;
                        if (video.src !== item.default_public_url) {
                          video.src = item.default_public_url;
                        }
                      }}
                    />
                  ) : (
                    <img
                      src={item.public_url}
                      alt={item.caption || "Media"}
                      className="w-16 h-16 object-cover rounded"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (img.src !== item.default_public_url) {
                          img.src = item.default_public_url;
                        }
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>{item.caption || '-'}</TableCell>
                <TableCell>{item.product_name || '-'}</TableCell>
                <TableCell>{item.product_code || '-'}</TableCell>
                <TableCell>{item.vendor_uid || '-'}</TableCell>
                <TableCell>{formatDate(item.purchase_date)}</TableCell>
                <TableCell>{item.quantity || '-'}</TableCell>
                <TableCell>{item.file_type}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
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
                      onClick={() => handleDelete(item.id)}
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
      <MediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
      />
    </>
  );
};

export default MediaTable;