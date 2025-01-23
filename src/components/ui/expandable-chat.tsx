import * as React from "react";
import { cn } from "@/lib/utils";

interface ExpandableChatProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  position?: "bottom-right" | "bottom-left";
  icon?: React.ReactNode;
}

interface ExpandableChatHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface ExpandableChatBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface ExpandableChatFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ExpandableChat = React.forwardRef<HTMLDivElement, ExpandableChatProps>(
  ({ className, children, size = "md", position = "bottom-right", icon, ...props }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    const sizeClasses = {
      sm: "w-[300px] h-[400px]",
      md: "w-[400px] h-[500px]",
      lg: "w-[500px] h-[600px]",
    };

    const positionClasses = {
      "bottom-right": "right-4 bottom-4",
      "bottom-left": "left-4 bottom-4",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "fixed z-50 flex flex-col",
          positionClasses[position],
          isExpanded ? sizeClasses[size] : "w-12 h-12",
          "transition-all duration-300 ease-in-out",
          className
        )}
        {...props}
      >
        {isExpanded ? (
          <div className="flex flex-col h-full bg-background border rounded-lg shadow-lg overflow-hidden">
            {children}
          </div>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
          >
            {icon}
          </button>
        )}
        {isExpanded && (
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute top-2 right-2 p-2 hover:bg-accent rounded-full"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);
ExpandableChat.displayName = "ExpandableChat";

const ExpandableChatHeader = React.forwardRef<HTMLDivElement, ExpandableChatHeaderProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}
      {...props}
    >
      {children}
    </div>
  )
);
ExpandableChatHeader.displayName = "ExpandableChatHeader";

const ExpandableChatBody = React.forwardRef<HTMLDivElement, ExpandableChatBodyProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto p-4", className)}
      {...props}
    >
      {children}
    </div>
  )
);
ExpandableChatBody.displayName = "ExpandableChatBody";

const ExpandableChatFooter = React.forwardRef<HTMLDivElement, ExpandableChatFooterProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-4 py-3 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}
      {...props}
    >
      {children}
    </div>
  )
);
ExpandableChatFooter.displayName = "ExpandableChatFooter";

export {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
};