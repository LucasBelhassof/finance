import { AlertTriangle, CopyCheck } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BankItem, CategoryItem, ImportCommitItem, ImportPreviewItem } from "@/types/api";

type ImportPreviewRowProps = {
  banks: BankItem[];
  draft: ImportCommitItem;
  item: ImportPreviewItem;
  categories: CategoryItem[];
  onChange: (previewToken: string, rowIndex: number, patch: Partial<ImportCommitItem>) => void;
  previewToken: string;
};

function buildBankOptions(banks: BankItem[], sourceKind: "bank_statement" | "credit_card_statement") {
  return banks.filter((bank) => {
    if (sourceKind === "credit_card_statement") {
      return bank.accountType === "credit_card";
    }

    return bank.accountType !== "credit_card";
  });
}

export default function ImportPreviewRow({ banks, draft, item, categories, onChange, previewToken }: ImportPreviewRowProps) {
  const filteredCategories = categories.filter((category) => category.transactionType === draft.type);
  const bankOptions = buildBankOptions(banks, draft.sourceKind ?? item.sourceKind);
  const categoryValue = String(draft.categoryId ?? "");

  return (
    <TableRow className={cn(draft.exclude && "opacity-55", item.possibleDuplicate && "bg-warning/5 hover:bg-warning/10")}>
      <TableCell className="px-3 py-4 align-top text-xs text-muted-foreground">
        <div className="flex flex-col gap-2">
          <span>#{item.rowIndex}</span>
          {item.possibleDuplicate ? <CopyCheck className="h-4 w-4 text-warning" /> : null}
          {item.issues.length > 0 ? <AlertTriangle className="h-4 w-4 text-destructive" /> : null}
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <div className="space-y-2">
          <Textarea
            value={draft.description}
            onChange={(event) => onChange(previewToken, item.rowIndex, { description: event.target.value })}
            rows={3}
            className="min-h-[84px] resize-none rounded-xl border-border/50 bg-secondary/30 text-sm"
          />
          {item.issues.map((issue, index) => (
            <p
              key={`${item.rowIndex}:issue:${index}`}
              className={cn("text-xs", issue.level === "error" ? "text-destructive" : "text-muted-foreground")}
            >
              {issue.message}
            </p>
          ))}
          {item.possibleDuplicate ? <p className="text-xs text-warning">{item.duplicateReason}</p> : null}
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <Input
          value={draft.amount}
          onChange={(event) => onChange(previewToken, item.rowIndex, { amount: event.target.value })}
          inputMode="decimal"
          className="h-10 rounded-xl border-border/50 bg-secondary/30 text-right font-medium tabular-nums"
        />
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <DatePickerInput
          value={draft.occurredOn}
          onChange={(value) => onChange(previewToken, item.rowIndex, { occurredOn: value })}
          className="h-10 rounded-xl"
          placeholder="Data"
        />
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <Select
          value={draft.type}
          onValueChange={(value: "income" | "expense") =>
            onChange(previewToken, item.rowIndex, {
              type: value,
              categoryId: draft.type === value ? draft.categoryId : "",
            })
          }
        >
          <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Despesa</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <Select
          value={categoryValue || undefined}
          onValueChange={(value) =>
            onChange(previewToken, item.rowIndex, { categoryId: value === "__uncategorized__" ? "" : value })
          }
        >
          <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            {draft.type === "expense" ? <SelectItem value="__uncategorized__">Outros</SelectItem> : null}
            {filteredCategories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <Select value={String(draft.bankConnectionId ?? "")} onValueChange={(value) => onChange(previewToken, item.rowIndex, { bankConnectionId: value })}>
          <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            {bankOptions.map((bank) => (
              <SelectItem key={bank.id} value={String(bank.id)}>
                {bank.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <Select
          value={draft.sourceKind ?? item.sourceKind}
          onValueChange={(value: "bank_statement" | "credit_card_statement") =>
            onChange(previewToken, item.rowIndex, {
              sourceKind: value,
              bankConnectionId: "",
            })
          }
        >
          <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bank_statement">Extrato</SelectItem>
            <SelectItem value="credit_card_statement">Fatura</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Checkbox
              checked={draft.exclude}
              onCheckedChange={(checked) => onChange(previewToken, item.rowIndex, { exclude: checked === true })}
            />
            Ignorar
          </label>
          <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Checkbox
              checked={draft.ignoreDuplicate}
              disabled={!item.possibleDuplicate}
              onCheckedChange={(checked) => onChange(previewToken, item.rowIndex, { ignoreDuplicate: checked === true })}
            />
            Forcar
          </label>
        </div>
      </TableCell>
    </TableRow>
  );
}
