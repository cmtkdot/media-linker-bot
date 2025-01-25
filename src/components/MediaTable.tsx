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
import { Edit } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { MediaItem } from "@/types/media";
import { getMediaCaption } from "@/utils/media-helpers";

interface MediaTableProps {
  data: MediaItem[];
  onEdit: (item: MediaItem) => void;
}

const MediaTable = ({ data, onEdit }: MediaTableProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Preview</TableHead>
            <TableHead>Product Name</TableHead>
            <TableHead>Product Code</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="w-[100px]">
                {item.file_type === 'video' ? (
                  <div className="relative w-[100px] h-[100px]">
                    <video
                      src={item.public_url}
                      className="w-full h-full object-cover rounded-md"
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                        <div className="w-0 h-0 border-l-[6px] border-l-black border-y-[4px] border-y-transparent ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.public_url}
                    alt={getMediaCaption(item) || "Media preview"}
                    className="w-[100px] h-[100px] object-cover rounded-md"
                    loading="lazy"
                  />
                )}
              </TableCell>
              <TableCell>{item.analyzed_content?.product_name || 'Untitled'}</TableCell>
              <TableCell>{item.analyzed_content?.product_code || 'No code'}</TableCell>
              <TableCell>{item.file_type}</TableCell>
              <TableCell>{item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Unknown'}</TableCell>
              <TableCell>
                <Button size="sm" variant="ghost" onClick={() => onEdit(item)}>
                  <Edit className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default MediaTable;