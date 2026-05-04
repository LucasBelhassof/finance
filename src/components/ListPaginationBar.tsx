import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ListPaginationBarProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
}

function buildPageRange(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: Array<number | "ellipsis"> = [];

  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, "ellipsis", total);
  } else if (current >= total - 3) {
    pages.push(1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "ellipsis", current - 1, current, current + 1, "ellipsis", total);
  }

  return pages;
}

export function ListPaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
  itemLabel = "itens",
}: ListPaginationBarProps) {
  if (totalPages <= 1 && totalItems <= pageSize) {
    return null;
  }

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const pageRange = buildPageRange(page, totalPages);

  return (
    <div className={cn("mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row", className)}>
      <span className="text-xs text-muted-foreground">
        {from}–{to} de {totalItems} {itemLabel}
      </span>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pageRange.map((entry, idx) =>
          entry === "ellipsis" ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex h-8 w-8 items-center justify-center text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <Button
              key={entry}
              variant={entry === page ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 rounded-lg text-xs"
              onClick={() => onPageChange(entry)}
              aria-current={entry === page ? "page" : undefined}
            >
              {entry}
            </Button>
          ),
        )}

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-lg"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
