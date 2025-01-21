import { Button } from "@/components/ui/button";
import { Grid, List, RefreshCw } from "lucide-react";

interface MediaViewToggleProps {
  view: 'grid' | 'table';
  onViewChange: (view: 'grid' | 'table') => void;
  onSync: () => void;
  isSyncing: boolean;
  canSync: boolean;
}

const MediaViewToggle = ({ view, onViewChange, onSync, isSyncing, canSync }: MediaViewToggleProps) => (
  <div className="flex space-x-2">
    <Button
      variant="outline"
      size="icon"
      onClick={onSync}
      disabled={!canSync || isSyncing}
    >
      <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
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
);

export default MediaViewToggle;