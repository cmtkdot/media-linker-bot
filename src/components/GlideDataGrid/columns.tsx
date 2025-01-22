"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { GlideSyncQueueItem } from "@/types/glide";

export const columns: ColumnDef<GlideSyncQueueItem>[] = [
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
    accessorKey: "table_name",
    header: "Table",
  },
  {
    accessorKey: "operation",
    header: "Operation",
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
    accessorKey: "error",
    header: "Error",
    cell: ({ row }) => row.getValue("error") || "None",
  },
];