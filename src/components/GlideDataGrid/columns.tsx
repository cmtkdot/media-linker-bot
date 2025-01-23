"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { FailedWebhookUpdate } from "@/types/glide";

export const columns: ColumnDef<FailedWebhookUpdate>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "message_id",
    header: "Message ID",
  },
  {
    accessorKey: "status",
    header: "Status",
  },
  {
    accessorKey: "error_message",
    header: "Error",
    cell: ({ row }) => row.getValue("error_message") || "None",
  },
  {
    accessorKey: "created_at",
    header: "Created At",
    cell: ({ row }) => {
      const date = row.getValue("created_at") as string;
      return date ? format(new Date(date), "PPpp") : "N/A";
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const item = row.original;
      return (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            if (typeof row.original.onDelete === 'function') {
              row.original.onDelete(item.id);
            }
          }}
          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      );
    },
  },
];