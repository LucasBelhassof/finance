import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BankItem, CategoryItem, ImportPreviewItem, ImportReviewDraft } from "@/types/api";

import ImportPreviewRow from "./ImportPreviewRow";

export type ImportPreviewTableRow = {
  key: string;
  draft: ImportReviewDraft;
  item: ImportPreviewItem;
  frontendErrors: string[];
  hasError: boolean;
  hasWarning: boolean;
  isDuplicate: boolean;
  isIgnored: boolean;
  needsReview: boolean;
};

type ImportPreviewTableProps = {
  banks: BankItem[];
  categories: CategoryItem[];
  currentPage: number;
  pageCount: number;
  rows: ImportPreviewTableRow[];
  allVisibleSelected: boolean;
  onChangeDraft: (rowKey: string, patch: Partial<ImportReviewDraft>) => void;
  onOpenCreateCategory: () => void;
  onPageChange: (page: number) => void;
  onToggleSelectAll: (checked: boolean) => void;
};

function buildPageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);
}

export default function ImportPreviewTable({
  banks,
  categories,
  currentPage,
  pageCount,
  rows,
  allVisibleSelected,
  onChangeDraft,
  onOpenCreateCategory,
  onPageChange,
  onToggleSelectAll,
}: ImportPreviewTableProps) {
  const pageNumbers = buildPageNumbers(currentPage, pageCount);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        <Table className="w-full min-w-[960px] table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
            <TableRow>
              <TableHead className="w-[4%] whitespace-nowrap">
                <Checkbox
                  checked={rows.length > 0 && allVisibleSelected}
                  onCheckedChange={(checked) => onToggleSelectAll(checked === true)}
                  aria-label="Selecionar linhas visíveis"
                />
              </TableHead>
              <TableHead className="w-[7%] whitespace-nowrap">Status</TableHead>
              <TableHead className="w-[10%] whitespace-nowrap">Data</TableHead>
              <TableHead className="w-[27%]">Descrição</TableHead>
              <TableHead className="w-[9%] whitespace-nowrap text-right">Valor</TableHead>
              <TableHead className="w-[10%] whitespace-nowrap">Tipo</TableHead>
              <TableHead className="w-[14%] whitespace-nowrap">Categoria</TableHead>
              <TableHead className="w-[12%] whitespace-nowrap">Conta / cartão</TableHead>
              <TableHead className="w-[7%] whitespace-nowrap">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <td colSpan={9} className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Nenhuma linha corresponde aos filtros atuais.
                </td>
              </TableRow>
            ) : (
              rows.map((row) => (
                <ImportPreviewRow
                  key={row.key}
                  banks={banks}
                  categories={categories}
                  row={row}
                  onChange={onChangeDraft}
                  onOpenCreateCategory={onOpenCreateCategory}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="border-t border-border/70 px-4 py-3">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    if (currentPage > 1) {
                      onPageChange(currentPage - 1);
                    }
                  }}
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              {pageNumbers.map((page) => (
                <PaginationItem key={`preview-page:${page}`}>
                  <PaginationLink
                    href="#"
                    isActive={page === currentPage}
                    onClick={(event) => {
                      event.preventDefault();
                      onPageChange(page);
                    }}
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    if (currentPage < pageCount) {
                      onPageChange(currentPage + 1);
                    }
                  }}
                  aria-disabled={currentPage === pageCount}
                  className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      ) : null}
    </div>
  );
}
