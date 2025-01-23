import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaItem } from "@/types/media";

interface MediaEditFormFieldProps {
  label: string;
  id: string;
  value: string | number | null;
  type?: string;
  onChange: (value: any) => void;
  onCaptionUpdate?: (item: MediaItem) => void;
  editItem?: MediaItem;
  field: keyof MediaItem;
}

const MediaEditFormField = ({
  label,
  id,
  value,
  type = "text",
  onChange,
  onCaptionUpdate,
  editItem,
  field
}: MediaEditFormFieldProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = type === "number" ? (parseInt(e.target.value) || null) : e.target.value;
    onChange(newValue);
    
    if (onCaptionUpdate && editItem) {
      const updatedItem = { ...editItem, [field]: newValue };
      onCaptionUpdate(updatedItem);
    }
  };

  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor={id} className="text-right">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value || ''}
        className="col-span-3"
        onChange={handleChange}
      />
    </div>
  );
};

export default MediaEditFormField;