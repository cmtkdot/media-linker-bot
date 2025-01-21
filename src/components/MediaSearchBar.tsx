import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Grid, List } from "lucide-react";

interface MediaSearchBarProps {
  search: string;
  view: 'grid' | 'table';
  onSearchChange: (value: string) => void;
  onViewChange: (view: 'grid' | 'table') => void;
}

const MediaSearchBar = ({ search, view, onSearchChange, onViewChange }: MediaSearchBarProps) => {
  return (
    <div className="flex justify-between items-center">
      <Input
        className="max-w-sm"
        placeholder="Search by caption, product name, code, or vendor..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="flex space-x-2">
        <Button
          variant={view === 'grid' ? "default" : "outline"}
          size="icon"
          onClick={() => onViewChange('grid')}
        >
          <Grid className="h-4 w-4" />
        </Button>
        <Button
          variant={view === 'table' ? "default" : "outline"}
          size="icon"
          onClick={() => onViewChange('table')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default MediaSearchBar;