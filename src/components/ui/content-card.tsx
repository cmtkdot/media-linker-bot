"use client"

import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Pencil, Play } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

interface ContentCardProps {
  className?: string
  backgroundImage?: string
  onEdit?: () => void
  onClick?: () => void
  content: {
    channelTitle?: string
    purchaseDate?: string
    productName: string
    caption?: string
  }
  isVideo?: boolean
}

export const ContentCard = ({ 
  className,
  backgroundImage,
  onEdit,
  onClick,
  content,
  isVideo
}: ContentCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [direction, setDirection] = useState<"top" | "bottom" | "left" | "right" | string>("left");

  const handleMouseEnter = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!ref.current) return;
    const direction = getDirection(event, ref.current);
    switch (direction) {
      case 0: setDirection("top"); break;
      case 1: setDirection("right"); break;
      case 2: setDirection("bottom"); break;
      case 3: setDirection("left"); break;
      default: setDirection("left"); break;
    }
  };

  const getDirection = (ev: React.MouseEvent<HTMLDivElement, MouseEvent>, obj: HTMLElement) => {
    const { width: w, height: h, left, top } = obj.getBoundingClientRect();
    const x = ev.clientX - left - (w / 2) * (w > h ? h / w : 1);
    const y = ev.clientY - top - (h / 2) * (h > w ? w / h : 1);
    return Math.round(Math.atan2(y, x) / 1.57079633 + 5) % 4;
  };

  return (
    <motion.div 
      ref={ref}
      onMouseEnter={handleMouseEnter}
      className="w-full group/card"
      onClick={onClick}
    >
      <AnimatePresence mode="wait">
        <motion.div
          className={cn(
            "cursor-pointer overflow-hidden relative card h-96 rounded-xl shadow-xl flex flex-col justify-between p-4 bg-cover bg-center",
            className
          )}
          style={{ backgroundImage: `url(${backgroundImage})` }}
          initial="initial"
          whileHover={direction}
          exit="exit"
        >
          <motion.div 
            className="absolute w-full h-full top-0 left-0 bg-black/40 transition-all duration-300 group-hover/card:bg-black/60" 
            variants={variants}
          />
          
          <div className="flex flex-row items-center justify-between z-10">
            <div className="flex flex-col">
              {content.channelTitle && (
                <p className="font-medium text-base text-white relative z-10">
                  {content.channelTitle}
                </p>
              )}
              {content.purchaseDate && (
                <p className="text-sm text-white/90 font-medium">
                  {content.purchaseDate}
                </p>
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

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-300">
              <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover/card:scale-110 transition-transform">
                <Play className="h-8 w-8 text-black" />
              </div>
            </div>
          )}

          <motion.div 
            className="text content"
            variants={textVariants}
          >
            <h1 className="font-bold text-xl md:text-2xl text-white relative z-10 transition-transform duration-300 group-hover/card:translate-y-[-4px]">
              {content.productName}
            </h1>
            {content.caption && (
              <p className="font-normal text-sm text-white relative z-10 my-4 line-clamp-3 transition-transform duration-300 group-hover/card:translate-y-[-4px]">
                {content.caption}
              </p>
            )}
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

const variants = {
  initial: { x: 0 },
  exit: { x: 0, y: 0 },
  top: { y: 20 },
  bottom: { y: -20 },
  left: { x: 20 },
  right: { x: -20 },
};

const textVariants = {
  initial: { y: 0, x: 0, opacity: 0 },
  exit: { y: 0, x: 0, opacity: 0 },
  top: { y: -20, opacity: 1 },
  bottom: { y: 2, opacity: 1 },
  left: { x: -2, opacity: 1 },
  right: { x: 20, opacity: 1 },
};