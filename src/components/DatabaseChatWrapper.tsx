"use client";

import { DatabaseExpandableChat } from "@/components/DatabaseExpandableChat";

export function DatabaseChatWrapper() {
  return (
    <div className="fixed bottom-0 right-0 z-50">
      <DatabaseExpandableChat />
    </div>
  );
}