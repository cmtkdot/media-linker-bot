import { Input } from "@/components/ui/input";

interface MediaSearchProps {
  value: string;
  onChange: (value: string) => void;
}

const MediaSearch = ({ value, onChange }: MediaSearchProps) => (
  <Input
    className="max-w-sm"
    placeholder="Search by caption, product name, code, or vendor..."
    value={value}
    onChange={(e) => onChange(e.target.value)}
  />
);

export default MediaSearch;