"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type DropdownMenuProps = {
  options: {
    label: string;
    onClick: () => void;
    Icon?: React.ReactNode;
  }[];
  children: React.ReactNode;
};

const DropdownMenu = ({ options, children }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <Button
        onClick={toggleDropdown}
        className="px-4 py-2 bg-background/80 dark:bg-background/40 hover:bg-background/90 dark:hover:bg-background/60 shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)] border border-border/50 dark:border-border/20 rounded-xl backdrop-blur-sm text-foreground dark:text-foreground/90"
      >
        {children ?? "Menu"}
        <>
          <motion.span
            className="ml-2"
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.4, ease: "easeInOut", type: "spring" }}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: -5, scale: 0.95, filter: "blur(10px)" }}
            animate={{ y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ y: -5, scale: 0.95, opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: "circInOut", type: "spring" }}
            className="absolute z-10 w-48 mt-2 p-1 bg-background/80 dark:bg-background/40 rounded-xl shadow-lg dark:shadow-[0_0_20px_rgba(0,0,0,0.4)] backdrop-blur-sm border border-border/50 dark:border-border/20 flex flex-col gap-2"
          >
            {options && options.length > 0 ? (
              options.map((option, index) => (
                <motion.button
                  initial={{
                    opacity: 0,
                    x: 10,
                    scale: 0.95,
                    filter: "blur(10px)",
                  }}
                  animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    x: 10,
                    scale: 0.95,
                    filter: "blur(10px)",
                  }}
                  transition={{
                    duration: 0.4,
                    delay: index * 0.1,
                    ease: "easeInOut",
                    type: "spring",
                  }}
                  whileHover={{
                    backgroundColor: "rgba(var(--background), 0.1)",
                    transition: {
                      duration: 0.4,
                      ease: "easeInOut",
                    },
                  }}
                  whileTap={{
                    scale: 0.95,
                    transition: {
                      duration: 0.2,
                      ease: "easeInOut",
                    },
                  }}
                  key={option.label}
                  onClick={option.onClick}
                  className="px-2 py-3 cursor-pointer text-foreground dark:text-foreground/90 text-sm rounded-lg w-full text-left flex items-center gap-x-2 hover:bg-accent/10 dark:hover:bg-accent/20"
                >
                  {option.Icon && (
                    <span className="text-muted-foreground">{option.Icon}</span>
                  )}
                  {option.label}
                </motion.button>
              ))
            ) : (
              <div className="px-4 py-2 text-muted-foreground text-xs">
                No options
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { DropdownMenu };