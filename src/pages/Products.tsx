import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageSwiper } from "@/components/ui/image-swiper";
import { MediaItem, MediaFileType, SupabaseMediaItem } from "@/types/media";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Products = () => {
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
        telegram_data: item.telegram_data as any,
        analyzed_content: item.analyzed_content ? {
          text: item.analyzed_content.text as string,
          labels: item.analyzed_content.labels as string[],
          objects: item.analyzed_content.objects as string[]
        } : undefined
      }));
    }
  });

  const groupMediaByProduct = (media: MediaItem[]) => {
    return media.reduce<Record<string, MediaItem[]>>((acc, item) => {
      const key = item.product_code || "uncategorized";
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});
  };

  const productGroups = products ? Object.values(groupMediaByProduct(products)) : [];

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold mb-8 text-center">Products Gallery</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {productGroups.map((group, index) => {
          const mainProduct = group[0];
          
          return (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-0">
                <ImageSwiper items={group} className="aspect-square" />
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
    </div>
  );
};

export default Products;
