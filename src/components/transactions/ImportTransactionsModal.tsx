import { FileSpreadsheet, FolderUp, Search, Upload } from "lucide-react";
import { type ChangeEvent, type DragEvent, type KeyboardEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";

import ImportPreviewTable, { type ImportPreviewTableRow } from "@/components/transactions/ImportPreviewTable";
import { ColorField } from "@/components/ui/color-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useCommitTransactionImport, useCreateCategory, useUniversalImportPreview } from "@/hooks/use-transactions";
import { DEFAULT_CATEGORY_COLOR } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import type {
  BankItem,
  CategoryItem,
  CreateCategoryInput,
  ImportCommitData,
  ImportCommitItem,
  ImportPreviewData,
  ImportPreviewItem,
  ImportReviewDraft,
  ImportSourceKind,
} from "@/types/api";

type ImportTransactionsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryItem[];
  banks: BankItem[];
};

type StepState = "upload" | "processing" | "preview" | "result";
type PreviewFilter = "all" | "valid" | "warnings" | "errors" | "duplicates" | "ignored";

type ModalState = {
  step: StepState;
  selectedFile: File | null;
  filePassword: string;
  passwordRequired: boolean;
  globalBankConnectionId: string;
  preview: ImportPreviewData | null;
  drafts: Record<string, ImportReviewDraft>;
  result: ImportCommitData | null;
  search: string;
  filter: PreviewFilter;
  page: number;
  processingLabelIndex: number;
};

type ModalAction =
  | { type: "reset" }
  | { type: "set-file"; file: File | null }
  | { type: "set-password"; value: string }
  | { type: "set-password-required"; value: boolean }
  | { type: "set-global-bank"; value: string }
  | { type: "set-step"; value: StepState }
  | { type: "set-preview"; preview: ImportPreviewData; drafts: Record<string, ImportReviewDraft> }
  | { type: "patch-draft"; rowKey: string; patch: Partial<ImportReviewDraft> }
  | { type: "set-result"; result: ImportCommitData }
  | { type: "set-search"; value: string }
  | { type: "set-filter"; value: PreviewFilter }
  | { type: "set-page"; value: number }
  | { type: "advance-processing" };

const PAGE_SIZE = 50;
const PROCESSING_LABELS = [
  "Lendo arquivo",
  "Detectando formato",
  "Detectando colunas",
  "Normalizando transações",
  "Gerando preview",
];
const transactionTypeOptions: Array<{ label: string; value: "income" | "expense" }> = [
  { label: "Despesa", value: "expense" },
  { label: "Receita", value: "income" },
];
const filterOptions: Array<{ value: PreviewFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "valid", label: "Válidas" },
  { value: "warnings", label: "Revisão" },
  { value: "errors", label: "Erros" },
  { value: "duplicates", label: "Duplicatas" },
  { value: "ignored", label: "Ignoradas" },
];

const initialState: ModalState = {
  step: "upload",
  selectedFile: null,
  filePassword: "",
  passwordRequired: false,
  globalBankConnectionId: "",
  preview: null,
  drafts: {},
  result: null,
  search: "",
  filter: "all",
  page: 1,
  processingLabelIndex: 0,
};

function makeDraftKey(previewToken: string, rowIndex: number) {
  return `${previewToken}:${rowIndex}`;
}

function isPdfFile(file: File | null) {
  if (!file) {
    return false;
  }

  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "0 KB";
  }

  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatConfidenceLabel(value: number | null) {
  return value === null ? "n/d" : `${Math.round(value * 100)}%`;
}

function getSourceKindLabel(sourceKind: ImportSourceKind) {
  switch (sourceKind) {
    case "credit_card_statement":
      return "Fatura de cartão";
    case "generic_transactions":
      return "Transações genéricas";
    case "unknown":
      return "Origem indefinida";
    case "bank_statement":
    default:
      return "Extrato bancário";
  }
}

function parseAmountInput(value: string) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return Number.NaN;
  }

  const normalized = trimmed
    .replace(/\s+/g, "")
    .replace(/R\$/gi, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  return Number.parseFloat(normalized);
}

function buildDrafts(preview: ImportPreviewData): Record<string, ImportReviewDraft> {
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
        bankConnectionId:
          item.bankConnectionId !== ""
            ? String(item.bankConnectionId)
            : preview.selectedBankConnectionId
              ? String(preview.selectedBankConnectionId)
              : "",
        sourceKind: item.sourceKind,
        exclude: item.defaultExclude,
        ignoreDuplicate: false,
        selected: false,
      },
    ]),
  );
}

function validateDraft(draft: ImportReviewDraft, item: ImportPreviewItem) {
  const errors: string[] = [];

  if (!draft.description.trim()) {
    errors.push("Descrição obrigatória.");
  }

  if (!draft.occurredOn.trim()) {
    errors.push("Data obrigatória.");
  }

  if (!Number.isFinite(parseAmountInput(draft.amount))) {
    errors.push("Valor inválido.");
  }

  if (draft.type === "unknown") {
    errors.push("Defina se a linha é despesa ou receita.");
  }

  if (!String(draft.bankConnectionId ?? "").trim()) {
    errors.push("Selecione a conta ou cartão.");
  }

  if (draft.type === "income" && !String(draft.categoryId ?? "").trim()) {
    errors.push("Categoria obrigatória para receitas.");
  }

  if (item.requiresCategorySelection && draft.type !== "expense" && !String(draft.categoryId ?? "").trim()) {
    errors.push("Categoria obrigatória para esta linha.");
  }

  return errors;
}

function buildCommitItem(draft: ImportReviewDraft): ImportCommitItem {
  if (draft.type === "unknown") {
    throw new Error("A linha ainda possui tipo indefinido.");
  }

  return {
    rowIndex: draft.rowIndex,
    description: draft.description.trim(),
    amount: draft.amount.trim(),
    occurredOn: draft.occurredOn.trim(),
    type: draft.type,
    ...(String(draft.categoryId ?? "").trim() ? { categoryId: draft.categoryId } : {}),
    ...(String(draft.bankConnectionId ?? "").trim() ? { bankConnectionId: draft.bankConnectionId } : {}),
    ...(draft.sourceKind ? { sourceKind: draft.sourceKind } : {}),
    exclude: draft.exclude,
    ignoreDuplicate: draft.ignoreDuplicate,
  };
}

function reducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case "reset":
      return initialState;
    case "set-file":
      return {
        ...state,
        selectedFile: action.file,
        filePassword: "",
        passwordRequired: action.file ? isPdfFile(action.file) : false,
      };
    case "set-password":
      return { ...state, filePassword: action.value };
    case "set-password-required":
      return { ...state, passwordRequired: action.value };
    case "set-global-bank":
      return { ...state, globalBankConnectionId: action.value };
    case "set-step":
      return { ...state, step: action.value };
    case "set-preview":
      return {
        ...state,
        preview: action.preview,
        drafts: action.drafts,
        step: "preview",
        result: null,
        page: 1,
      };
    case "patch-draft":
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [action.rowKey]: {
            ...state.drafts[action.rowKey],
            ...action.patch,
          },
        },
      };
    case "set-result":
      return { ...state, result: action.result, step: "result" };
    case "set-search":
      return { ...state, search: action.value, page: 1 };
    case "set-filter":
      return { ...state, filter: action.value, page: 1 };
    case "set-page":
      return { ...state, page: action.value };
    case "advance-processing":
      return { ...state, processingLabelIndex: (state.processingLabelIndex + 1) % PROCESSING_LABELS.length };
    default:
      return state;
  }
}

function matchesFilter(row: ImportPreviewTableRow, filter: PreviewFilter, search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (
    normalizedSearch &&
    ![row.draft.description, row.item.description, row.item.normalizedDescription]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch)
  ) {
    return false;
  }

  switch (filter) {
    case "valid":
      return !row.isIgnored && !row.hasError && !row.hasWarning && !row.isDuplicate && !row.needsReview;
    case "warnings":
      return !row.hasError && (row.hasWarning || row.needsReview);
    case "errors":
      return row.hasError;
    case "duplicates":
      return row.isDuplicate;
    case "ignored":
      return row.isIgnored;
    case "all":
    default:
      return true;
  }
}

function PreviewCountChip({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "warning" | "error";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs",
        variant === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
        variant === "warning" && "border-warning/30 bg-warning/10",
        !variant && "border-border/70 bg-secondary/30",
      )}
    >
      <span className="font-semibold">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export default function ImportTransactionsModal({ open, onOpenChange, categories, banks }: ImportTransactionsModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bulkAccountValue, setBulkAccountValue] = useState("");
  const [bulkTypeValue, setBulkTypeValue] = useState<"income" | "expense" | "unknown" | "">("");
  const [bulkCategoryValue, setBulkCategoryValue] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    label: "",
    transactionType: "expense",
    icon: "Wallet",
    color: DEFAULT_CATEGORY_COLOR,
    groupLabel: "Outros",
    groupColor: DEFAULT_CATEGORY_COLOR,
  });
  const previewImport = useUniversalImportPreview();
  const commitImport = useCommitTransactionImport();
  const createCategory = useCreateCategory();

  useEffect(() => {
    if (!open) {
      dispatch({ type: "reset" });
      setDragActive(false);
      setSubmitting(false);
      setBulkAccountValue("");
      setBulkTypeValue("");
      setBulkCategoryValue("");
      setCategoryDialogOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (state.step !== "processing") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      dispatch({ type: "advance-processing" });
    }, 850);

    return () => window.clearInterval(interval);
  }, [state.step]);

  const rows = useMemo<ImportPreviewTableRow[]>(() => {
    if (!state.preview) {
      return [];
    }

    return state.preview.items.map((item) => {
      const key = makeDraftKey(state.preview!.previewToken, item.rowIndex);
      const draft = state.drafts[key];
      const frontendErrors = validateDraft(draft, item);
      const backendHasError = item.issues.some((issue) => issue.level === "error");
      const backendHasWarning = item.issues.some((issue) => issue.level === "warning");
      const lowConfidence = (item.confidence ?? 1) < 0.75;
      const needsReview = lowConfidence || draft.type === "unknown" || item.requiresUserAction || backendHasWarning;

      return {
        key,
        draft,
        item,
        frontendErrors,
        hasError: backendHasError || frontendErrors.length > 0,
        hasWarning: backendHasWarning || lowConfidence,
        isDuplicate: item.possibleDuplicate,
        isIgnored: draft.exclude,
        needsReview,
      };
    });
  }, [state.drafts, state.preview]);

  const visibleRows = useMemo(
    () => rows.filter((row) => matchesFilter(row, state.filter, state.search)),
    [rows, state.filter, state.search],
  );

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(state.page, pageCount);
  const paginatedRows = visibleRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedRows = visibleRows.filter((row) => row.draft.selected);
  const selectedCount = selectedRows.length;
  const allVisibleSelected = paginatedRows.length > 0 && paginatedRows.every((row) => row.draft.selected);
  const showPasswordField = state.passwordRequired || isPdfFile(state.selectedFile);

  const summary = state.preview?.fileSummary;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: "set-file", file: event.target.files?.[0] ?? null });
    event.target.value = "";
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openFilePicker();
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    dispatch({ type: "set-file", file: event.dataTransfer.files?.[0] ?? null });
  };

  const handlePreview = async () => {
    if (!state.selectedFile) {
      toast.error("Selecione um arquivo para gerar o preview.");
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
      toast.success("Preview gerado com sucesso.");
    } catch (error) {
      dispatch({ type: "set-step", value: "upload" });
      const errorCode = error instanceof Error && "code" in error ? String(error.code) : "";

      if (errorCode === "import_pdf_password_required" || errorCode === "import_pdf_password_invalid") {
        dispatch({ type: "set-password-required", value: true });
        window.setTimeout(() => passwordInputRef.current?.focus(), 0);
      }

      toast.error("Não foi possível gerar o preview.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  const patchRows = (targetRows: ImportPreviewTableRow[], patch: Partial<ImportReviewDraft>) => {
    targetRows.forEach((row) => dispatch({ type: "patch-draft", rowKey: row.key, patch }));
  };

  const applyBulkPatch = (patch: Partial<ImportReviewDraft>) => {
    if (!selectedRows.length) {
      toast.error("Selecione ao menos uma linha para aplicar a ação em lote.");
      return;
    }

    patchRows(selectedRows, patch);
  };

  const handleBulkAccount = (value: string) => {
    setBulkAccountValue(value);
    if (value) {
      applyBulkPatch({ bankConnectionId: value });
      setBulkAccountValue("");
    }
  };

  const handleBulkType = (value: "income" | "expense" | "unknown") => {
    setBulkTypeValue(value);
    applyBulkPatch({ type: value, categoryId: "" });
    setBulkTypeValue("");
  };

  const handleBulkCategory = (value: string) => {
    setBulkCategoryValue(value);
    applyBulkPatch({ categoryId: value === "__uncategorized__" ? "" : value });
    setBulkCategoryValue("");
  };

  const buildCommitRows = (onlyValidRows: boolean) => {
    const candidateRows = rows.filter((row) => !row.draft.exclude);

    if (onlyValidRows) {
      return candidateRows.filter((row) => !row.hasError && !row.hasWarning && !row.isDuplicate && !row.needsReview);
    }

    return candidateRows;
  };

  const handleCommit = async (onlyValidRows: boolean) => {
    if (!state.preview) {
      return;
    }

    const candidateRows = buildCommitRows(onlyValidRows);

    if (!candidateRows.length) {
      toast.error(onlyValidRows ? "Nenhuma linha válida foi encontrada para importar." : "Nenhuma linha foi marcada para importação.");
      return;
    }

    if (!onlyValidRows) {
      const invalidRows = candidateRows.filter((row) => row.frontendErrors.length > 0);

      if (invalidRows.length > 0) {
        toast.error("Revise as linhas com erros antes de confirmar a importação.");
        dispatch({ type: "set-filter", value: "errors" });
        return;
      }
    }

    setSubmitting(true);

    try {
      const result = await commitImport.mutateAsync({
        previewToken: state.preview.previewToken,
        bankConnectionId: state.globalBankConnectionId || undefined,
        items: candidateRows.map((row) => buildCommitItem(row.draft)),
      });
      dispatch({ type: "set-result", result });
      toast.success(`${result.importedCount} importadas, ${result.skippedCount} ignoradas e ${result.failedCount} com falha.`);
    } catch (error) {
      toast.error("Não foi possível concluir a importação.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.label.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    try {
      await createCategory.mutateAsync(categoryForm);
      toast.success("Categoria criada.");
      setCategoryDialogOpen(false);
      setCategoryForm({
        label: "",
        transactionType: "expense",
        icon: "Wallet",
        color: DEFAULT_CATEGORY_COLOR,
        groupLabel: "Outros",
        groupColor: DEFAULT_CATEGORY_COLOR,
      });
    } catch (error) {
      toast.error("Não foi possível criar a categoria.", {
        description: error instanceof Error ? error.message : "Tente novamente em instantes.",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[92vh] max-w-[92vw] flex-col overflow-hidden p-0 sm:max-w-7xl">
          <div className="border-b border-border/70 px-6 py-5">
            <DialogHeader>
              <DialogTitle>Import transactions</DialogTitle>
              <DialogDescription>
                Envie CSV, Excel, OFX, QIF, PDF, TXT ou JSON. O sistema detecta o formato e você revisa tudo antes do commit.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-6 py-5">
            {state.step === "upload" ? (
              <div className="grid h-full gap-5 lg:grid-cols-[1.5fr,0.9fr]">
                <div
                  role="button"
                  tabIndex={0}
                  data-testid="import-file-dropzone"
                  className={cn(
                    "flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed px-8 text-center transition-colors",
                    dragActive ? "border-primary bg-primary/5" : "border-border/70 bg-secondary/15",
                  )}
                  onClick={openFilePicker}
                  onKeyDown={handleDropzoneKeyDown}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleFileDrop}
                >
                  <div className="rounded-full bg-primary/10 p-4 text-primary">
                    <FileSpreadsheet className="h-10 w-10" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-foreground">Arraste o arquivo aqui ou selecione manualmente</p>
                    <p className="max-w-xl text-sm text-muted-foreground">
                      O preview universal detecta o tipo do arquivo, normaliza as transações e destaca linhas que precisam de revisão.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl"
                    onClick={(event) => {
                      event.stopPropagation();
                      openFilePicker();
                    }}
                  >
                    <FolderUp className="mr-2 h-4 w-4" />
                    Select file
                  </Button>
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    {["CSV", "Excel", "OFX", "QIF", "PDF", "TXT", "JSON"].map((format) => (
                      <Badge key={`import-format:${format}`} variant="outline" className="rounded-full">
                        {format}
                      </Badge>
                    ))}
                  </div>
                  {state.selectedFile ? (
                    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-left">
                      <p className="font-medium text-foreground">{state.selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(state.selectedFile.size)}</p>
                    </div>
                  ) : null}
                </div>
                <Input ref={inputRef} data-testid="import-file-input" type="file" className="hidden" onChange={handleFileChange} />

                <div className="flex flex-col justify-between rounded-[28px] border border-border/70 bg-background/70 p-5">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">Conta ou cartão padrão</p>
                      <p className="text-sm text-muted-foreground">
                        Opcional. Você também pode definir conta/cartão por linha no preview.
                      </p>
                      <Select value={state.globalBankConnectionId} onValueChange={(value) => dispatch({ type: "set-global-bank", value })}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Definir depois no preview" />
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

                    {showPasswordField ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Senha do PDF</p>
                        <p className="text-sm text-muted-foreground">
                          Preencha apenas se o arquivo estiver protegido por senha.
                        </p>
                        <Input
                          ref={passwordInputRef}
                          value={state.filePassword}
                          onChange={(event) => dispatch({ type: "set-password", value: event.target.value })}
                          placeholder="Digite a senha do PDF"
                          className="h-11 rounded-xl"
                        />
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                      Linhas ambíguas ou com baixa confiança continuam no preview. Nada é importado silenciosamente.
                    </div>
                  </div>

                  <Button type="button" className="mt-5 h-11 rounded-xl" onClick={handlePreview} disabled={!state.selectedFile || previewImport.isPending}>
                    <Upload className="mr-2 h-4 w-4" />
                    Generate preview
                  </Button>
                </div>
              </div>
            ) : null}

            {state.step === "processing" ? (
              <div className="flex h-full flex-col items-center justify-center gap-5 rounded-[28px] border border-border/70 bg-secondary/15 p-8 text-center">
                <div className="rounded-full bg-primary/10 p-5 text-primary">
                  <FileSpreadsheet className="h-12 w-12 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">{PROCESSING_LABELS[state.processingLabelIndex]}</p>
                  <p className="text-sm text-muted-foreground">{state.selectedFile?.name ?? "Arquivo selecionado"}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(state.selectedFile?.size ?? 0)}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {PROCESSING_LABELS.map((label, index) => (
                    <Badge key={`processing:${label}`} variant={index === state.processingLabelIndex ? "default" : "outline"}>
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {state.step === "preview" && state.preview ? (
              <div className="flex h-full min-h-0 flex-col gap-3">
                {/* Compact summary header */}
                <div className="rounded-[28px] border border-border/70 bg-background/70 px-4 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {state.preview.fileMetadata.originalFilename ?? state.selectedFile?.name ?? "Importação"}
                        </span>
                        <Badge variant="secondary">{getSourceKindLabel(state.preview.detectedSourceKind)}</Badge>
                      </div>
                    </div>
                    {summary ? (
                      <div className="flex flex-wrap gap-2">
                        <PreviewCountChip label="Total" value={summary.totalRows} />
                        <PreviewCountChip label="Prontas" value={summary.importableRows} />
                        {summary.warningRows > 0 ? <PreviewCountChip label="Revisão" value={summary.warningRows} variant="warning" /> : null}
                        {summary.errorRows > 0 ? <PreviewCountChip label="Erros" value={summary.errorRows} variant="error" /> : null}
                        {summary.duplicateRows > 0 ? <PreviewCountChip label="Dup." value={summary.duplicateRows} /> : null}
                      </div>
                    ) : null}
                  </div>

                  {state.preview.warnings.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-foreground">
                      {state.preview.warnings.join(" ")}
                    </div>
                  ) : null}

                  <details data-testid="import-technical-details" className="mt-3">
                    <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
                      Detalhes de importação
                    </summary>
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-5">
                      {state.preview.parserLabel ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Parser</p>
                          <p className="text-xs font-medium">{state.preview.parserLabel}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo de arquivo</p>
                        <p className="text-xs font-medium">{state.preview.detectedFileType ?? "n/d"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Confiança</p>
                        <p className="text-xs font-medium">{formatConfidenceLabel(state.preview.sourceKindConfidence)}</p>
                      </div>
                      {state.preview.institutionName ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Instituição</p>
                          <p className="text-xs font-medium">{state.preview.institutionName}</p>
                        </div>
                      ) : null}
                      {state.preview.accountHint ? (
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conta sugerida</p>
                          <p className="text-xs font-medium">{state.preview.accountHint}</p>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </div>

                {/* Filters + search + bulk actions */}
                <div className="rounded-[28px] border border-border/70 bg-background/70 px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-1">
                      {filterOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant={state.filter === option.value ? "secondary" : "ghost"}
                          className="h-8 rounded-lg px-3 text-xs"
                          onClick={() => dispatch({ type: "set-filter", value: option.value })}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                    <div className="relative min-w-0 flex-1 sm:max-w-[280px]">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="h-9 rounded-xl pl-9"
                        placeholder="Buscar por descrição"
                        value={state.search}
                        onChange={(event) => dispatch({ type: "set-search", value: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {selectedCount > 0 ? (
                      <Badge variant="secondary" className="mr-1 text-xs">
                        {selectedCount} selecionada(s)
                      </Badge>
                    ) : null}
                    <Select value={bulkAccountValue} onValueChange={handleBulkAccount} disabled={selectedCount === 0}>
                      <SelectTrigger className="h-9 rounded-xl xl:w-[200px]">
                        <SelectValue placeholder="Definir conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((bank) => (
                          <SelectItem key={`bulk-bank:${bank.id}`} value={String(bank.id)}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={bulkTypeValue} onValueChange={handleBulkType} disabled={selectedCount === 0}>
                      <SelectTrigger className="h-9 rounded-xl xl:w-[160px]">
                        <SelectValue placeholder="Definir tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Definir depois</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={bulkCategoryValue} onValueChange={handleBulkCategory} disabled={selectedCount === 0}>
                      <SelectTrigger className="h-9 rounded-xl xl:w-[200px]">
                        <SelectValue placeholder="Definir categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__uncategorized__">Outros</SelectItem>
                        {categories.map((category) => (
                          <SelectItem key={`bulk-category:${category.id}`} value={String(category.id)}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => applyBulkPatch({ exclude: true })}
                      disabled={selectedCount === 0}
                    >
                      Ignorar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => applyBulkPatch({ exclude: false })}
                      disabled={selectedCount === 0}
                    >
                      Restaurar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => {
                        const duplicateRows = selectedRows.filter((row) => row.isDuplicate);

                        if (!duplicateRows.length) {
                          toast.error("Selecione ao menos uma linha duplicada.");
                          return;
                        }

                        patchRows(duplicateRows, { exclude: true });
                      }}
                      disabled={selectedCount === 0}
                    >
                      Remover dup.
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" onClick={() => setCategoryDialogOpen(true)}>
                      Nova categoria
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 rounded-xl xl:ml-auto"
                      onClick={() => void handleCommit(true)}
                      disabled={submitting || commitImport.isPending}
                    >
                      Import valid rows only
                    </Button>
                  </div>
                </div>

                <div data-testid="import-preview-body" className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-border/70 bg-background/70">
                  <ImportPreviewTable
                    banks={banks}
                    categories={categories}
                    currentPage={currentPage}
                    pageCount={pageCount}
                    rows={paginatedRows}
                    allVisibleSelected={allVisibleSelected}
                    onChangeDraft={(rowKey, patch) => dispatch({ type: "patch-draft", rowKey, patch })}
                    onOpenCreateCategory={() => setCategoryDialogOpen(true)}
                    onPageChange={(page) => dispatch({ type: "set-page", value: page })}
                    onToggleSelectAll={(checked) => {
                      paginatedRows.forEach((row) => dispatch({ type: "patch-draft", rowKey: row.key, patch: { selected: checked } }));
                    }}
                  />
                </div>
              </div>
            ) : null}

            {state.step === "result" && state.result ? (
              <div className="flex h-full flex-col gap-4 rounded-[28px] border border-border/70 bg-background/70 p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Importadas</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{state.result.importedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Ignoradas</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{state.result.skippedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Falhas</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{state.result.failedCount}</p>
                  </div>
                </div>

                {state.result.results.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground">
                      Ver detalhes por linha ({state.result.results.length})
                    </summary>
                    <div className="mt-3 rounded-2xl border border-border/70">
                      <div className="grid grid-cols-[80px,100px,1fr] border-b border-border/70 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Linha</span>
                        <span>Status</span>
                        <span>Mensagem</span>
                      </div>
                      <div className="scrollbar-thin max-h-[300px] overflow-auto">
                        {state.result.results.map((item) => (
                          <div
                            key={`result:${item.rowIndex}`}
                            className="grid grid-cols-[80px,100px,1fr] gap-3 border-b border-border/70 px-4 py-2.5 text-sm last:border-b-0"
                          >
                            <span>#{item.rowIndex}</span>
                            <span className="font-medium">{item.status}</span>
                            <span>{item.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/70 px-6 py-4">
            <DialogFooter>
              {state.step === "preview" ? (
                <>
                  <Button type="button" variant="outline" onClick={() => dispatch({ type: "reset" })}>
                    Nova importação
                  </Button>
                  <Button type="button" onClick={() => void handleCommit(false)} disabled={submitting || commitImport.isPending}>
                    Confirmar importação
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
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-[510px] border-border/70 bg-card p-6">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
            <DialogDescription className="sr-only">Formulário de criação de categoria</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              value={categoryForm.label}
              onChange={(event) => setCategoryForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="Nome da categoria"
              className="h-11 rounded-xl border-border/60 bg-secondary/35"
            />

            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-secondary/60 p-1">
              {transactionTypeOptions.map((option) => {
                const active = categoryForm.transactionType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setCategoryForm((current) => ({ ...current, transactionType: option.value }))}
                    className={cn(
                      "rounded-xl px-4 py-2.5 text-sm transition-colors",
                      active
                        ? option.value === "expense"
                          ? "bg-expense/20 text-expense"
                          : "bg-income/20 text-income"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <ColorField
              label="Cor"
              value={categoryForm.groupColor || categoryForm.color}
              onChange={(nextColor) =>
                setCategoryForm((current) => ({
                  ...current,
                  color: nextColor,
                  groupColor: nextColor,
                }))
              }
              inputAriaLabel="Selecionar cor da categoria"
              fallback={DEFAULT_CATEGORY_COLOR}
            />
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateCategory()} disabled={createCategory.isPending}>
              {createCategory.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
