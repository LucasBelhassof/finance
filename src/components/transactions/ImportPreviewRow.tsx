import { AlertTriangle, CopyCheck, Sparkles } from "lucide-react";

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

function getSourceKindLabel(sourceKind: ImportSourceKind) {
  switch (sourceKind) {
    case "credit_card_statement":
      return "Fatura";
    case "generic_transactions":
      return "Genérico";
    case "unknown":
      return "Indefinido";
    case "bank_statement":
    default:
      return "Extrato";
  }
}

export default function ImportPreviewRow({ banks, categories, row, onChange, onOpenCreateCategory }: ImportPreviewRowProps) {
  const { draft, item } = row;
  const sourceKind = draft.sourceKind ?? item.sourceKind;
  const filteredCategories = categories.filter((category) => draft.type !== "unknown" && category.transactionType === draft.type);
  const bankOptions = buildBankOptions(banks, sourceKind);
  const categoryValue = String(draft.categoryId ?? "");
  const statusMessages = [
    ...row.frontendErrors.map((message) => ({ kind: "error" as const, message })),
    ...item.issues.map((issue) => ({
      kind: issue.level === "error" ? ("error" as const) : ("warning" as const),
      message: issue.message,
    })),
  ];

  return (
    <TableRow
      className={cn(
        draft.exclude && "opacity-55",
        row.hasError && "bg-destructive/5 hover:bg-destructive/10",
        !row.hasError && row.hasWarning && "bg-warning/5 hover:bg-warning/10",
      )}
    >
      <TableCell className="px-3 py-4 align-top">
        <Checkbox
          checked={draft.selected}
          onCheckedChange={(checked) => onChange(row.key, { selected: checked === true })}
          aria-label={`Selecionar linha ${item.rowIndex}`}
        />
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <Checkbox
          checked={!draft.exclude}
          onCheckedChange={(checked) => onChange(row.key, { exclude: checked !== true })}
          aria-label={`Importar linha ${item.rowIndex}`}
        />
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <DatePickerInput
          value={draft.occurredOn}
          onChange={(value) => onChange(row.key, { occurredOn: value })}
          className="h-10 rounded-xl"
          placeholder="Data"
        />
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">#{item.rowIndex}</span>
            {item.isInstallment ? <Badge variant="outline">Parcela {item.installmentIndex ?? "?"}/{item.installmentCount ?? "?"}</Badge> : null}
            {row.needsReview ? <Badge variant="secondary">Revisar</Badge> : null}
          </div>
          <Textarea
            value={draft.description}
            onChange={(event) => onChange(row.key, { description: event.target.value })}
            rows={3}
            className="min-h-[88px] resize-none rounded-xl border-border/50 bg-secondary/30 text-sm"
          />
          {item.externalId ? <p className="text-xs text-muted-foreground">ID externo: {item.externalId}</p> : null}
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <Input
          value={draft.amount}
          onChange={(event) => onChange(row.key, { amount: event.target.value })}
          inputMode="decimal"
          className="h-10 rounded-xl border-border/50 bg-secondary/30 text-right font-medium tabular-nums"
        />
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
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
      <TableCell className="px-3 py-4 align-top">
        <div className="space-y-2">
          <Select value={categoryValue || undefined} onValueChange={(value) => onChange(row.key, { categoryId: value === "__uncategorized__" ? "" : value })}>
            <SelectTrigger className="h-10 rounded-xl border-border/50 bg-secondary/30">
              <SelectValue placeholder={draft.type === "income" ? "Categoria obrigatória" : "Categoria"} />
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
          <Button type="button" variant="ghost" size="sm" className="h-8 px-0 text-xs" onClick={onOpenCreateCategory}>
            Nova categoria
          </Button>
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <Select value={String(draft.bankConnectionId ?? "")} onValueChange={(value) => onChange(row.key, { bankConnectionId: value })}>
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
      <TableCell className="px-3 py-4 align-top">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {row.hasError ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Erro
              </Badge>
            ) : null}
            {!row.hasError && row.hasWarning ? (
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                Atenção
              </Badge>
            ) : null}
            <Badge variant="outline">{getSourceKindLabel(sourceKind)}</Badge>
          </div>
          <div className="space-y-1">
            {statusMessages.slice(0, 3).map((issue, index) => (
              <p key={`${row.key}:status:${index}`} className={cn("text-xs", issue.kind === "error" ? "text-destructive" : "text-muted-foreground")}>
                {issue.message}
              </p>
            ))}
            {statusMessages.length > 3 ? <p className="text-xs text-muted-foreground">+{statusMessages.length - 3} avisos</p> : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <div className="space-y-2">
          {item.possibleDuplicate ? (
            <>
              <Badge variant="outline" className="gap-1">
                <CopyCheck className="h-3.5 w-3.5" />
                Possível
              </Badge>
              <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Checkbox
                  checked={draft.ignoreDuplicate}
                  onCheckedChange={(checked) => onChange(row.key, { ignoreDuplicate: checked === true })}
                />
                Forçar mesmo assim
              </label>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Sem indício</span>
          )}
        </div>
      </TableCell>
      <TableCell className="px-3 py-4 align-top">
        <div className="space-y-2">
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => onChange(row.key, { exclude: !draft.exclude })}>
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
