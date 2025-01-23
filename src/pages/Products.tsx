import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { MediaItem, MediaFileType, SupabaseMediaItem } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import MediaViewer from "@/components/MediaViewer";

const Products = () => {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const { data: products } = useQuery<MediaItem[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((item: SupabaseMediaItem): MediaItem => ({
        ...item,
        file_type: item.file_type as MediaFileType,
        telegram_data: item.telegram_data as Record<string, any>,
        analyzed_content: item.analyzed_content ? {
          text: (item.analyzed_content as any).text as string,
          labels: (item.analyzed_content as any).labels as string[],
          objects: (item.analyzed_content as any).objects as string[]
        } : undefined,
        glide_data: item.glide_data as Record<string, any>,
        media_metadata: item.media_metadata as Record<string, any>
      }));
    }
  });

  const groupMediaByProduct = (media: MediaItem[]) => {
    return media.reduce<Record<string, MediaItem[]>>((acc, item) => {
      const groupId = item.telegram_data?.media_group_id || item.id;
      if (!acc[groupId]) {
        acc[groupId] = [];
      }
      acc[groupId].push(item);
      return acc;
    }, {});
  };

  const sortMediaItems = (items: MediaItem[]) => {
    return [...items].sort((a, b) => {
      if (a.file_type === 'photo' && b.file_type !== 'photo') return -1;
      if (a.file_type !== 'photo' && b.file_type === 'photo') return 1;
      return 0;
    });
  };

  const productGroups = products ? Object.values(groupMediaByProduct(products)) : [];

  const handleMediaClick = (media: MediaItem, group: MediaItem[]) => {
    setSelectedMedia(media);
    setViewerOpen(true);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Products Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {productGroups.map((group, index) => {
          const sortedGroup = sortMediaItems(group);
          const mainProduct = sortedGroup[0];
          const [currentIndex, setCurrentIndex] = useState(0);
          
          const handlePrevious = (e: React.MouseEvent) => {
            e.stopPropagation();
            setCurrentIndex((prev) => (prev > 0 ? prev - 1 : sortedGroup.length - 1));
          };

          const handleNext = (e: React.MouseEvent) => {
            e.stopPropagation();
            setCurrentIndex((prev) => (prev < sortedGroup.length - 1 ? prev + 1 : 0));
          };
          
          return (
            <Card key={index} className="overflow-hidden group">
              <CardContent className="p-0">
                <div className="relative aspect-square" onClick={() => handleMediaClick(sortedGroup[currentIndex], sortedGroup)}>
                  {sortedGroup[currentIndex].file_type === 'video' ? (
                    <div className="relative w-full h-full">
                      <img
                        src={sortedGroup[currentIndex].thumbnail_url || sortedGroup[currentIndex].default_public_url}
                        alt={sortedGroup[currentIndex].caption || ''}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img
                      src={sortedGroup[currentIndex].public_url || sortedGroup[currentIndex].default_public_url}
                      alt={sortedGroup[currentIndex].caption || ''}
                      className="w-full h-full object-cover"
                    />
                  )}

                  {sortedGroup.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevious}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-opacity"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={handleNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-opacity"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded-md text-xs">
                        {currentIndex + 1} / {sortedGroup.length}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
              <CardHeader className="space-y-4">
                <CardTitle className="text-2xl font-bold">
                  {mainProduct.product_name || "Untitled Product"}
                </CardTitle>
                {mainProduct.caption && (
                  <p className="text-lg text-muted-foreground mt-4">
                    {mainProduct.caption}
                  </p>
                )}
                {mainProduct.purchase_date && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Purchase Date: {format(new Date(mainProduct.purchase_date), "MM/dd/yyyy")}
                  </p>
                )}
                {mainProduct.product_code && (
                  <p className="text-sm font-medium text-sky-500 dark:text-sky-400">
                    Product Code: {mainProduct.product_code}
                  </p>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <MediaViewer
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        media={selectedMedia}
        relatedMedia={selectedMedia ? productGroups.find(group => 
          group.some(item => item.id === selectedMedia.id)
        ) || [selectedMedia] : []}
      />
    </div>
  );
};

export default Products;