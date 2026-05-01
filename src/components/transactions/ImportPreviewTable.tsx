import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { BankItem, CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

import ImportPreviewRow from "./ImportPreviewRow";

export type ImportPreviewTableRow = {
  draft: ImportCommitItem;
  item: ImportPreviewItem;
  previewToken: string;
};

type ImportPreviewTableProps = {
  banks: BankItem[];
  categories: CategoryItem[];
  rows: ImportPreviewTableRow[];
  onChangeDraft: (previewToken: string, rowIndex: number, patch: Partial<ImportCommitItem>) => void;
};

export default function ImportPreviewTable({ banks, categories, rows, onChangeDraft }: ImportPreviewTableProps) {
  return (
    <Table className="w-full table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[7%] whitespace-nowrap">Linha</TableHead>
          <TableHead className="w-[22%]">Descricao</TableHead>
          <TableHead className="w-[10%] whitespace-nowrap">Valor</TableHead>
          <TableHead className="w-[11%] whitespace-nowrap">Data</TableHead>
          <TableHead className="w-[10%] whitespace-nowrap">Tipo</TableHead>
          <TableHead className="w-[12%] whitespace-nowrap">Categoria</TableHead>
          <TableHead className="w-[12%] whitespace-nowrap">Conta</TableHead>
          <TableHead className="w-[8%] whitespace-nowrap">Origem</TableHead>
          <TableHead className="w-[8%] whitespace-nowrap">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <ImportPreviewRow
            key={`${row.previewToken}:${row.item.rowIndex}`}
            banks={banks}
            categories={categories}
            draft={row.draft}
            item={row.item}
            onChange={onChangeDraft}
            previewToken={row.previewToken}
          />
        ))}
      </TableBody>
    </Table>
  );
}
