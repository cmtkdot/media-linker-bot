import { ColumnDef } from "@tanstack/react-table";
import { GlideSyncQueueItem } from "@/types/glide";

export const columns: ColumnDef<GlideSyncQueueItem>[] = [
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
      const date = row.getValue("created_at");
      return date ? new Date(date as string).toLocaleString() : "N/A";
    },
  },
  {
    accessorKey: "processed_at",
    header: "Processed At",
    cell: ({ row }) => {
      const date = row.getValue("processed_at");
      return date ? new Date(date as string).toLocaleString() : "Pending";
    },
  },
  {
    accessorKey: "error",
    header: "Error",
    cell: ({ row }) => row.getValue("error") || "None",
  },
];