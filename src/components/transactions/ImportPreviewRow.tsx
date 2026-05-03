import { AlertTriangle, CopyCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerInput } from "@/components/ui/date-picker-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BankItem, CategoryItem, ImportPreviewItem, ImportReviewDraft, ImportSourceKind } from "@/types/api";

import type { ImportPreviewTableRow } from "./ImportPreviewTable";

type ImportPreviewRowProps = {
  banks: BankItem[];
  categories: CategoryItem[];
  row: ImportPreviewTableRow;
  onChange: (rowKey: string, patch: Partial<ImportReviewDraft>) => void;
  onOpenCreateCategory: () => void;
};

function buildBankOptions(banks: BankItem[], sourceKind: ImportSourceKind) {
  if (sourceKind === "credit_card_statement") {
    return banks.filter((bank) => bank.accountType === "credit_card");
  }

  if (sourceKind === "bank_statement") {
    return banks.filter((bank) => bank.accountType !== "credit_card");
  }

  return banks;
}

function RowStatusBadge({ row }: { row: ImportPreviewTableRow }) {
  if (row.isIgnored) {
    return (
      <Badge variant="outline" className="whitespace-nowrap text-xs text-muted-foreground">
        Ignorado
      </Badge>
    );
  }

  if (row.hasError) {
    return (
      <Badge variant="destructive" className="gap-1 whitespace-nowrap text-xs">
        <AlertTriangle className="h-3 w-3" />
        Erro
      </Badge>
    );
  }

  if (row.isDuplicate) {
    return (
      <Badge variant="outline" className="gap-1 whitespace-nowrap text-xs">
        <CopyCheck className="h-3 w-3" />
        Possível dup.
      </Badge>
    );
  }

  if (row.needsReview) {
    return (
      <Badge variant="secondary" className="whitespace-nowrap text-xs">
        Revisar
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="whitespace-nowrap text-xs text-green-600 dark:text-green-400">
      Pronto
    </Badge>
  );
}

export default function ImportPreviewRow({
  banks,
  categories,
  row,
  onChange,
  onOpenCreateCategory,
}: ImportPreviewRowProps) {
  const { draft, item } = row;
  const sourceKind = draft.sourceKind ?? item.sourceKind;
  const filteredCategories = categories.filter(
    (category) => draft.type !== "unknown" && category.transactionType === draft.type,
  );
  const bankOptions = buildBankOptions(banks, sourceKind);
  const categoryValue = String(draft.categoryId ?? "");
  const allIssues = [
    ...row.frontendErrors.map((message) => ({ kind: "error" as const, message })),
    ...item.issues.map((issue) => ({
      kind: issue.level === "error" ? ("error" as const) : ("warning" as const),
      message: issue.message,
    })),
  ];
  const firstIssue = allIssues[0];

  return (
    <TableRow
      className={cn(
        row.isIgnored && "opacity-55",
        row.hasError && "bg-destructive/5 hover:bg-destructive/10",
        !row.hasError && row.hasWarning && "bg-warning/5 hover:bg-warning/10",
      )}
    >
      {/* Select */}
      <TableCell className="px-3 py-3 align-top">
        <Checkbox
          checked={draft.selected}
          onCheckedChange={(checked) => onChange(row.key, { selected: checked === true })}
          aria-label={`Selecionar linha ${item.rowIndex}`}
        />
      </TableCell>

      {/* Status */}
      <TableCell className="px-3 py-3 align-top">
        <RowStatusBadge row={row} />
      </TableCell>

      {/* Date */}
      <TableCell className="px-3 py-3 align-top">
        <DatePickerInput
          value={draft.occurredOn}
          onChange={(value) => onChange(row.key, { occurredOn: value })}
          className="h-10 rounded-xl"
          placeholder="Data"
        />
      </TableCell>

      {/* Description */}
      <TableCell className="px-3 py-3 align-top">
        <div className="space-y-1.5">
          {item.isInstallment ? (
            <p className="text-xs text-muted-foreground">
              Parcela {item.installmentIndex ?? "?"}/{item.installmentCount ?? "?"}
            </p>
          ) : null}
          <Textarea
            value={draft.description}
            onChange={(event) => onChange(row.key, { description: event.target.value })}
            rows={2}
            className="min-h-[64px] resize-none rounded-xl border-border/50 bg-secondary/30 text-sm"
          />
          {firstIssue ? (
            <p
              className={cn(
                "truncate text-xs",
                firstIssue.kind === "error" ? "text-destructive" : "text-muted-foreground",
              )}
              title={allIssues.map((i) => i.message).join(" • ")}
            >
              {firstIssue.message}
            </p>
          ) : null}
          {row.isDuplicate ? (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox
                checked={draft.ignoreDuplicate}
                onCheckedChange={(checked) => onChange(row.key, { ignoreDuplicate: checked === true })}
              />
              Importar mesmo assim
            </label>
          ) : null}
          {item.externalId ? <p className="text-xs text-muted-foreground">ID externo: {item.externalId}</p> : null}
        </div>
      </TableCell>

      {/* Amount */}
      <TableCell className="px-3 py-3 align-top">
        <Input
          value={draft.amount}
          onChange={(event) => onChange(row.key, { amount: event.target.value })}
          inputMode="decimal"
          className="h-10 rounded-xl border-border/50 bg-secondary/30 text-right font-medium tabular-nums"
        />
      </TableCell>

      {/* Type */}
      <TableCell className="px-3 py-3 align-top">
        <Select
          value={draft.type}
          onValueChange={(value: "income" | "expense" | "unknown") =>
            onChange(row.key, {
              type: value,
              categoryId: value === draft.type ? draft.categoryId : "",
            })
          }
        >
          <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unknown">Definir depois</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>

      {/* Category */}
      <TableCell className="px-3 py-3 align-top">
        <div className="space-y-1.5">
          <Select
            value={categoryValue || undefined}
            onValueChange={(value) => onChange(row.key, { categoryId: value === "__uncategorized__" ? "" : value })}
          >
            <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
              <SelectValue placeholder={draft.type === "income" ? "Categoria obrigatória" : "Categoria"} />
            </SelectTrigger>
            <SelectContent>
              {draft.type === "expense" ? <SelectItem value="__uncategorized__">Compras</SelectItem> : null}
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-0 text-xs" onClick={onOpenCreateCategory}>
            Nova categoria
          </Button>
        </div>
      </TableCell>

      {/* Account */}
      <TableCell className="px-3 py-3 align-top">
        <Select
          value={String(draft.bankConnectionId ?? "")}
          onValueChange={(value) => onChange(row.key, { bankConnectionId: value })}
        >
          <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
            <SelectValue placeholder="Selecionar conta" />
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

      {/* Actions */}
      <TableCell className="px-3 py-3 align-top">
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => onChange(row.key, { exclude: !draft.exclude })}
          >
            {draft.exclude ? "Restaurar" : "Ignorar"}
          </Button>
          <Select
            value={sourceKind}
            onValueChange={(value: ImportSourceKind) =>
              onChange(row.key, {
                sourceKind: value,
                bankConnectionId: "",
              })
            }
          >
            <SelectTrigger className="h-8 rounded-xl border-border/50 bg-secondary/30 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_statement">Extrato</SelectItem>
              <SelectItem value="credit_card_statement">Fatura</SelectItem>
              <SelectItem value="generic_transactions">Genérico</SelectItem>
              <SelectItem value="unknown">Indefinido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </TableCell>
    </TableRow>
  );
}
