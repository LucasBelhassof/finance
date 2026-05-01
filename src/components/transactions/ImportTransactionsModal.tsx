import { FileSpreadsheet, Search, Upload } from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";

import ImportPreviewTable, { type ImportPreviewTableRow } from "@/components/transactions/ImportPreviewTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useCommitTransactionImport, useUniversalImportPreview } from "@/hooks/use-transactions";
import type { BankItem, CategoryItem, ImportCommitItem, ImportCommitData, ImportPreviewData } from "@/types/api";

type ImportTransactionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryItem[];
  banks: BankItem[];
};

type StepState = "upload" | "processing" | "preview" | "result";

type ModalState = {
  step: StepState;
  selectedFile: File | null;
  filePassword: string;
  globalBankConnectionId: string;
  preview: ImportPreviewData | null;
  drafts: Record<string, ImportCommitItem>;
  result: ImportCommitData | null;
  search: string;
  filter: "all" | "action_required" | "duplicates" | "ignored";
};

type ModalAction =
  | { type: "reset" }
  | { type: "set-file"; file: File | null }
  | { type: "set-password"; value: string }
  | { type: "set-global-bank"; value: string }
  | { type: "set-step"; value: StepState }
  | { type: "set-preview"; preview: ImportPreviewData; drafts: Record<string, ImportCommitItem> }
  | { type: "patch-draft"; previewToken: string; rowIndex: number; patch: Partial<ImportCommitItem> }
  | { type: "set-result"; result: ImportCommitData }
  | { type: "set-search"; value: string }
  | { type: "set-filter"; value: ModalState["filter"] };

const initialState: ModalState = {
  step: "upload",
  selectedFile: null,
  filePassword: "",
  globalBankConnectionId: "",
  preview: null,
  drafts: {},
  result: null,
  search: "",
  filter: "all",
};

function makeDraftKey(previewToken: string, rowIndex: number) {
  return `${previewToken}:${rowIndex}`;
}

function buildDrafts(preview: ImportPreviewData): Record<string, ImportCommitItem> {
  return Object.fromEntries(
    preview.items.map((item) => [
      makeDraftKey(preview.previewToken, item.rowIndex),
      {
        rowIndex: item.rowIndex,
        description: item.description,
        amount: item.amount,
        occurredOn: item.occurredOn,
        type: item.type,
        categoryId: item.suggestedCategoryId ? String(item.suggestedCategoryId) : "",
        bankConnectionId: item.bankConnectionId ? String(item.bankConnectionId) : preview.selectedBankConnectionId ? String(preview.selectedBankConnectionId) : "",
        sourceKind: item.sourceKind,
        exclude: item.defaultExclude,
        ignoreDuplicate: false,
      },
    ]),
  );
}

function reducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "reset":
      return initialState;
    case "set-file":
      return { ...state, selectedFile: action.file, filePassword: "" };
    case "set-password":
      return { ...state, filePassword: action.value };
    case "set-global-bank":
      return { ...state, globalBankConnectionId: action.value };
    case "set-step":
      return { ...state, step: action.value };
    case "set-preview":
      return { ...state, preview: action.preview, drafts: action.drafts, step: "preview", result: null };
    case "patch-draft": {
      const key = makeDraftKey(action.previewToken, action.rowIndex);
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [key]: {
            ...state.drafts[key],
            ...action.patch,
          },
        },
      };
    }
    case "set-result":
      return { ...state, result: action.result, step: "result" };
    case "set-search":
      return { ...state, search: action.value };
    case "set-filter":
      return { ...state, filter: action.value };
    default:
      return state;
  }
}

function matchesFilter(row: ImportPreviewTableRow, filter: ModalState["filter"], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (normalizedSearch && !row.draft.description.toLowerCase().includes(normalizedSearch)) {
    return false;
  }

  if (filter === "action_required") {
    return row.item.requiresUserAction || row.item.issues.some((issue) => issue.level === "error");
  }

  if (filter === "duplicates") {
    return row.item.possibleDuplicate;
  }

  if (filter === "ignored") {
    return row.draft.exclude;
  }

  return true;
}

export default function ImportTransactionsModal({ open, onOpenChange, categories, banks }: ImportTransactionsModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [submitting, setSubmitting] = useState(false);
  const previewImport = useUniversalImportPreview();
  const commitImport = useCommitTransactionImport();

  useEffect(() => {
    if (!open) {
      dispatch({ type: "reset" });
      setSubmitting(false);
    }
  }, [open]);

  const rows = useMemo<ImportPreviewTableRow[]>(() => {
    if (!state.preview) {
      return [];
    }

    return state.preview.items.map((item) => ({
      previewToken: state.preview!.previewToken,
      item,
      draft: state.drafts[makeDraftKey(state.preview!.previewToken, item.rowIndex)],
    }));
  }, [state.drafts, state.preview]);

  const visibleRows = useMemo(
    () => rows.filter((row) => matchesFilter(row, state.filter, state.search)),
    [rows, state.filter, state.search],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "set-file", file: event.target.files?.[0] ?? null });
    event.target.value = "";
  };

  const handlePreview = async () => {
    if (!state.selectedFile) {
      toast.error("Selecione um arquivo para gerar a previa.");
      return;
    }

    dispatch({ type: "set-step", value: "processing" });

    try {
      const preview = await previewImport.mutateAsync({
        file: state.selectedFile,
        bankConnectionId: state.globalBankConnectionId || undefined,
        filePassword: state.filePassword,
      });
      dispatch({ type: "set-preview", preview, drafts: buildDrafts(preview) });
      toast.success("Previa gerada com sucesso.");
    } catch (error) {
      dispatch({ type: "set-step", value: "upload" });
      const errorCode = error instanceof Error && "code" in error ? String(error.code) : "";

      if (errorCode === "import_pdf_password_required" || errorCode === "import_pdf_password_invalid") {
        window.setTimeout(() => passwordInputRef.current?.focus(), 0);
      }

      toast.error("Nao foi possivel gerar a previa.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const handleCommit = async () => {
    if (!state.preview) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await commitImport.mutateAsync({
        previewToken: state.preview.previewToken,
        bankConnectionId: state.globalBankConnectionId || undefined,
        items: rows.map((row) => row.draft),
      });
      dispatch({ type: "set-result", result });
      toast.success(`${result.importedCount} importadas, ${result.skippedCount} ignoradas e ${result.failedCount} com falha.`);
    } catch (error) {
      toast.error("Nao foi possivel concluir a importacao.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const summary = state.preview?.fileSummary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-7xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Importador universal</DialogTitle>
          <DialogDescription>
            Envie CSV, PDF, XLSX, OFX, QIF, JSON ou TXT. O tipo e inferido automaticamente e pode ser corrigido no preview.
          </DialogDescription>
        </DialogHeader>

        {state.step === "upload" ? (
          <div className="grid gap-4 md:grid-cols-[1.4fr,1fr]">
            <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-secondary/20 px-6 text-center">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Arraste o arquivo ou clique para selecionar</p>
                <p className="text-sm text-muted-foreground">CSV, TSV, PDF, XLSX, XLS, OFX, QIF, JSON e TXT</p>
              </div>
              <Input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
              <Button type="button" variant="secondary">
                <Upload className="mr-2 h-4 w-4" />
                Escolher arquivo
              </Button>
              {state.selectedFile ? <p className="text-sm text-muted-foreground">{state.selectedFile.name}</p> : null}
            </label>

            <div className="space-y-4 rounded-2xl border border-border/70 bg-background/60 p-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Conta ou cartao global</p>
                <Select value={state.globalBankConnectionId} onValueChange={(value) => dispatch({ type: "set-global-bank", value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Definir no preview, linha por linha" />
                  </SelectTrigger>
                  <SelectContent>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={String(bank.id)}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Senha do PDF</p>
                <Input
                  ref={passwordInputRef}
                  value={state.filePassword}
                  onChange={(event) => dispatch({ type: "set-password", value: event.target.value })}
                  placeholder="Preencha apenas se o arquivo pedir senha"
                />
              </div>
              <Button type="button" className="w-full" onClick={handlePreview} disabled={!state.selectedFile || previewImport.isPending}>
                Gerar previa
              </Button>
            </div>
          </div>
        ) : null}

        {state.step === "processing" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-border/70 bg-secondary/15">
            <FileSpreadsheet className="h-12 w-12 animate-pulse text-primary" />
            <div className="space-y-1 text-center">
              <p className="font-medium">Processando arquivo</p>
              <p className="text-sm text-muted-foreground">{state.selectedFile?.name ?? "Arquivo selecionado"}</p>
            </div>
          </div>
        ) : null}

        {state.step === "preview" && state.preview ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-border/70 p-3">
                <p className="text-xs uppercase text-muted-foreground">Arquivo</p>
                <p className="font-medium">{state.preview.fileMetadata.originalFilename ?? state.selectedFile?.name ?? "Importacao"}</p>
                <p className="text-sm text-muted-foreground">{state.preview.detectedFileType ?? "desconhecido"}</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-3">
                <p className="text-xs uppercase text-muted-foreground">Origem detectada</p>
                <p className="font-medium">{state.preview.detectedSourceKind === "credit_card_statement" ? "Fatura" : "Extrato"}</p>
                <p className="text-sm text-muted-foreground">Confianca {Math.round((state.preview.sourceKindConfidence ?? 0) * 100)}%</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-3">
                <p className="text-xs uppercase text-muted-foreground">Linhas</p>
                <p className="font-medium">{summary?.totalRows ?? 0}</p>
                <p className="text-sm text-muted-foreground">{summary?.importableRows ?? 0} importaveis</p>
              </div>
              <div className="rounded-2xl border border-border/70 p-3">
                <p className="text-xs uppercase text-muted-foreground">Acoes</p>
                <div className="mt-2 flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => rows.forEach((row) => dispatch({ type: "patch-draft", previewToken: row.previewToken, rowIndex: row.item.rowIndex, patch: { exclude: false } }))}>
                    Importar tudo
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => rows.forEach((row) => dispatch({ type: "patch-draft", previewToken: row.previewToken, rowIndex: row.item.rowIndex, patch: { exclude: true } }))}>
                    Ignorar tudo
                  </Button>
                </div>
              </div>
            </div>

            {state.preview.warnings.length > 0 ? (
              <div className="rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
                {state.preview.warnings.join(" ")}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar por descricao" value={state.search} onChange={(event) => dispatch({ type: "set-search", value: event.target.value })} />
              </div>
              <Select value={state.filter} onValueChange={(value: ModalState["filter"]) => dispatch({ type: "set-filter", value })}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as linhas</SelectItem>
                  <SelectItem value="action_required">Revisao obrigatoria</SelectItem>
                  <SelectItem value="duplicates">Duplicatas</SelectItem>
                  <SelectItem value="ignored">Ignoradas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div data-testid="import-preview-body" className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/70">
              <ImportPreviewTable
                banks={banks}
                categories={categories}
                rows={visibleRows}
                onChangeDraft={(previewToken, rowIndex, patch) => dispatch({ type: "patch-draft", previewToken, rowIndex, patch })}
              />
            </div>
          </>
        ) : null}

        {state.step === "result" && state.result ? (
          <div className="flex flex-1 flex-col justify-center gap-4 rounded-2xl border border-border/70 p-6">
            <div>
              <p className="text-lg font-semibold">Importacao concluida</p>
              <p className="text-sm text-muted-foreground">
                {state.result.importedCount} importadas, {state.result.skippedCount} ignoradas e {state.result.failedCount} com falha.
              </p>
            </div>
            <div className="max-h-[320px] overflow-auto rounded-xl border border-border/70">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30 text-left">
                  <tr>
                    <th className="px-3 py-2">Linha</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {state.result.results.map((item) => (
                    <tr key={`result:${item.rowIndex}`} className="border-t border-border/70">
                      <td className="px-3 py-2">#{item.rowIndex}</td>
                      <td className="px-3 py-2">{item.status}</td>
                      <td className="px-3 py-2">{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          {state.step === "preview" ? (
            <>
              <Button type="button" variant="outline" onClick={() => dispatch({ type: "reset" })}>
                Nova importacao
              </Button>
              <Button type="button" onClick={handleCommit} disabled={submitting || commitImport.isPending}>
                Confirmar importacao
              </Button>
            </>
          ) : state.step === "result" ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
