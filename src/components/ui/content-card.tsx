"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"

interface ContentCardProps {
  className?: string
  backgroundImage?: string
  onEdit?: () => void
  content: {
    channelTitle?: string
    purchaseDate?: string
    productName: string
    caption?: string
  }
}

export const ContentCard = ({ 
  className,
  backgroundImage,
  onEdit,
  content
}: ContentCardProps) => {
  return (
    <div className="w-full group/card">
      <div
        className={cn(
          "cursor-pointer overflow-hidden relative card h-96 rounded-xl shadow-xl flex flex-col justify-between p-4 bg-cover bg-center",
          className
        )}
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        <div className="absolute w-full h-full top-0 left-0 bg-black/40 transition-all duration-300 group-hover/card:bg-black/60" />
        
        <div className="flex flex-row items-center justify-between z-10">
          <div className="flex flex-col">
            {content.channelTitle && (
              <p className="font-medium text-base text-gray-50 relative z-10">
                {content.channelTitle}
              </p>
            )}
            {content.purchaseDate && (
              <p className="text-sm text-gray-400">{content.purchaseDate}</p>
            )}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            className="h-10 w-10 rounded-full bg-white/90 hover:bg-white shrink-0 transition-transform group-hover/card:scale-110"
          >
            <Pencil className="h-4 w-4 text-black" />
          </Button>
        </div>

        <div className="text content">
          <h1 className="font-bold text-xl md:text-2xl text-gray-50 relative z-10 transition-transform duration-300 group-hover/card:translate-y-[-4px]">
            {content.productName}
          </h1>
          {content.caption && (
            <p className="font-normal text-sm text-gray-50 relative z-10 my-4 line-clamp-3 transition-transform duration-300 group-hover/card:translate-y-[-4px]">
              {content.caption}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}