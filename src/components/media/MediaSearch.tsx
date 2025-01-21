import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Grid, List, Wand2 } from "lucide-react";

interface MediaSearchProps {
  search: string;
  onSearchChange: (value: string) => void;
  view: 'grid' | 'table';
  onViewChange: (view: 'grid' | 'table') => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  canAnalyze: boolean;
}

const MediaSearch = ({
  search,
  onSearchChange,
  view,
  onViewChange,
  onAnalyze,
  isAnalyzing,
  canAnalyze
}: MediaSearchProps) => {
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
          variant="outline"
          size="icon"
          onClick={onAnalyze}
          disabled={!canAnalyze || isAnalyzing}
        >
          <Wand2 className={`h-4 w-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
        </Button>
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

export default MediaSearch;