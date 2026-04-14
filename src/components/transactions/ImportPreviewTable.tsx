import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

import ImportPreviewRow from "./ImportPreviewRow";

type ImportPreviewTableProps = {
  categories: CategoryItem[];
  drafts: Record<number, ImportCommitItem>;
  items: ImportPreviewItem[];
  onChangeDraft: (rowIndex: number, patch: Partial<ImportCommitItem>) => void;
  onCreateCategory: (rowIndex: number) => void;
};

export default function ImportPreviewTable({
  categories,
  drafts,
  items,
  onChangeDraft,
  onCreateCategory,
}: ImportPreviewTableProps) {
  return (
    <Table className="w-full min-w-[980px] table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-14 whitespace-nowrap">Linha</TableHead>
          <TableHead className="w-[280px]">Descricao</TableHead>
          <TableHead className="w-[132px] whitespace-nowrap">Valor</TableHead>
          <TableHead className="w-[132px] whitespace-nowrap">Data</TableHead>
          <TableHead className="w-[156px] whitespace-nowrap">Tipo</TableHead>
          <TableHead className="w-[192px] whitespace-nowrap">Categoria</TableHead>
          <TableHead className="w-[176px] whitespace-nowrap">Acoes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <ImportPreviewRow
            key={item.rowIndex}
            item={item}
            draft={drafts[item.rowIndex]}
            categories={categories}
            onChange={onChangeDraft}
            onCreateCategory={onCreateCategory}
          />
        ))}
      </TableBody>
    </Table>
  );
}
