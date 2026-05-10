import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, type PageSizeOption } from "@/hooks/use-pagination";

interface PageSizeSelectProps {
  value?: PageSizeOption;
  onChange: (value: PageSizeOption) => void;
  className?: string;
}

export function PageSizeSelect({ value = DEFAULT_PAGE_SIZE, onChange, className }: PageSizeSelectProps) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v) as PageSizeOption)}>
      <SelectTrigger className={className ?? "h-8 w-14 justify-center rounded-lg px-0 text-xs"}>
        <span>{value}</span>
      </SelectTrigger>
      <SelectContent>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <SelectItem key={size} value={String(size)} className="text-xs">
            {size} linhas
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
