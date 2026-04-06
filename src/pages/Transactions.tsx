import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { Bell, Plus, Search, Filter, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, Tag, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type TransactionType = "expense" | "income";

interface Category {
  id: string;
  label: string;
  color: string;
}

interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  amount: number;
  category: string;
  date: string;
}

const defaultCategories: Category[] = [
  { id: "food", label: "Alimentação", color: "hsl(var(--warning))" },
  { id: "transport", label: "Transporte", color: "hsl(var(--info))" },
  { id: "housing", label: "Moradia", color: "hsl(var(--primary))" },
  { id: "health", label: "Saúde", color: "hsl(var(--income))" },
  { id: "entertainment", label: "Lazer", color: "hsl(var(--expense))" },
  { id: "salary", label: "Salário", color: "hsl(var(--primary))" },
  { id: "freelance", label: "Freelance", color: "hsl(var(--info))" },
  { id: "subscriptions", label: "Assinaturas", color: "hsl(var(--warning))" },
];

const defaultTransactions: Transaction[] = [
  { id: "1", type: "expense", description: "Pão de Açúcar", amount: 342.5, category: "food", date: "2025-04-06" },
  { id: "2", type: "expense", description: "iFood", amount: 67.9, category: "food", date: "2025-04-06" },
  { id: "3", type: "expense", description: "Uber", amount: 23.5, category: "transport", date: "2025-04-05" },
  { id: "4", type: "expense", description: "Aluguel", amount: 2200, category: "housing", date: "2025-04-01" },
  { id: "5", type: "income", description: "Salário", amount: 8500, category: "salary", date: "2025-04-05" },
  { id: "6", type: "expense", description: "Netflix", amount: 55.9, category: "subscriptions", date: "2025-04-03" },
  { id: "7", type: "income", description: "Projeto Web", amount: 3200, category: "freelance", date: "2025-04-02" },
  { id: "8", type: "expense", description: "Farmácia", amount: 45.8, category: "health", date: "2025-04-01" },
];

const categoryColors = [
  "hsl(var(--primary))",
  "hsl(var(--warning))",
  "hsl(var(--info))",
  "hsl(var(--expense))",
  "hsl(var(--income))",
  "hsl(210, 60%, 50%)",
  "hsl(280, 60%, 50%)",
  "hsl(30, 80%, 55%)",
];

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(defaultTransactions);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | TransactionType>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Transaction dialog
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txForm, setTxForm] = useState({ type: "expense" as TransactionType, description: "", amount: "", category: "", date: "" });

  // Category dialog
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ label: "", color: categoryColors[0] });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = transactions
    .filter((tx) => {
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (filterCategory !== "all" && tx.category !== filterCategory) return false;
      if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const openNewTx = (type: TransactionType) => {
    setEditingTx(null);
    setTxForm({ type, description: "", amount: "", category: categories[0]?.id || "", date: new Date().toISOString().split("T")[0] });
    setTxDialogOpen(true);
  };

  const openEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setTxForm({ type: tx.type, description: tx.description, amount: String(tx.amount), category: tx.category, date: tx.date });
    setTxDialogOpen(true);
  };

  const saveTx = () => {
    if (!txForm.description || !txForm.amount || !txForm.category) return;
    if (editingTx) {
      setTransactions((prev) => prev.map((t) => (t.id === editingTx.id ? { ...t, ...txForm, amount: parseFloat(txForm.amount) } : t)));
    } else {
      const newTx: Transaction = { id: Date.now().toString(), ...txForm, amount: parseFloat(txForm.amount) };
      setTransactions((prev) => [newTx, ...prev]);
    }
    setTxDialogOpen(false);
  };

  const deleteTx = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setDeleteTarget(null);
  };

  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ label: "", color: categoryColors[0] });
    setCatDialogOpen(true);
  };

  const openEditCat = (cat: Category) => {
    setEditingCat(cat);
    setCatForm({ label: cat.label, color: cat.color });
    setCatDialogOpen(true);
  };

  const saveCat = () => {
    if (!catForm.label) return;
    if (editingCat) {
      setCategories((prev) => prev.map((c) => (c.id === editingCat.id ? { ...c, ...catForm } : c)));
    } else {
      const newCat: Category = { id: catForm.label.toLowerCase().replace(/\s+/g, "-") + Date.now(), ...catForm };
      setCategories((prev) => [...prev, newCat]);
    }
    setCatDialogOpen(false);
  };

  const deleteCat = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const getCat = (id: string) => categories.find((c) => c.id === id);

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeItem="Transações" />

      <main className="flex-1 overflow-y-auto scrollbar-thin">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Transações</h1>
              <p className="text-sm text-muted-foreground">Gerencie suas despesas e receitas</p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => openNewTx("income")} className="gap-1.5">
                <ArrowUpCircle size={14} />
                Receita
              </Button>
              <Button size="sm" onClick={() => openNewTx("expense")} className="gap-1.5">
                <ArrowDownCircle size={14} />
                Despesa
              </Button>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Receitas</p>
              <p className="text-lg font-bold text-income">+ R$ {totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Despesas</p>
              <p className="text-lg font-bold text-expense">- R$ {totalExpense.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="glass-card p-4">
              <p className="text-xs text-muted-foreground mb-1">Saldo</p>
              <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? "text-income" : "text-expense"}`}>
                R$ {(totalIncome - totalExpense).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar transação..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted-foreground" />
                {(["all", "income", "expense"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      filterType === t ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "all" ? "Todas" : t === "income" ? "Receitas" : "Despesas"}
                  </button>
                ))}
              </div>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-secondary text-sm text-foreground border border-border/50 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">Todas categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Transactions list */}
            <div className="lg:col-span-3 glass-card p-5 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Todas as Transações</h3>
                <span className="text-xs text-muted-foreground">{filtered.length} transações</span>
              </div>

              <div className="space-y-1">
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transação encontrada.</p>
                )}
                {filtered.map((tx) => {
                  const cat = getCat(tx.category);
                  return (
                    <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors group">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cat ? `${cat.color}20` : undefined }}
                      >
                        {tx.type === "income" ? (
                          <ArrowUpCircle size={16} className="text-income" />
                        ) : (
                          <ArrowDownCircle size={16} className="text-expense" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.description}</p>
                        <div className="flex items-center gap-2">
                          {cat && (
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${cat.color}15`, color: cat.color }}>
                              {cat.label}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{new Date(tx.date).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                      <p className={`text-sm font-semibold ${tx.type === "expense" ? "text-expense" : "text-income"}`}>
                        {tx.type === "expense" ? "- " : "+ "}R$ {tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditTx(tx)} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteTarget(tx.id)} className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Categories panel */}
            <div className="glass-card p-5 animate-fade-in h-fit">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground text-sm">Categorias</h3>
                <button onClick={openNewCat} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                  <Plus size={14} />
                </button>
              </div>
              <div className="space-y-1.5">
                {categories.map((cat) => {
                  const count = transactions.filter((t) => t.category === cat.id).length;
                  return (
                    <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors group">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-foreground flex-1 truncate">{cat.label}</span>
                      <span className="text-xs text-muted-foreground">{count}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditCat(cat)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                          <Pencil size={11} />
                        </button>
                        <button onClick={() => deleteCat(cat.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Transaction Dialog */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingTx ? "Editar Transação" : txForm.type === "income" ? "Nova Receita" : "Nova Despesa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              {(["expense", "income"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTxForm((f) => ({ ...f, type: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    txForm.type === t
                      ? t === "income" ? "bg-income/20 text-income" : "bg-expense/20 text-expense"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {t === "income" ? "Receita" : "Despesa"}
                </button>
              ))}
            </div>
            <Input
              placeholder="Descrição"
              value={txForm.description}
              onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))}
              className="bg-secondary/50 border-border/50"
            />
            <Input
              type="number"
              placeholder="Valor (R$)"
              value={txForm.amount}
              onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))}
              className="bg-secondary/50 border-border/50"
            />
            <select
              value={txForm.category}
              onChange={(e) => setTxForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full bg-secondary/50 text-sm text-foreground border border-border/50 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecione a categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <Input
              type="date"
              value={txForm.date}
              onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))}
              className="bg-secondary/50 border-border/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveTx}>{editingTx ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Nome da categoria"
              value={catForm.label}
              onChange={(e) => setCatForm((f) => ({ ...f, label: e.target.value }))}
              className="bg-secondary/50 border-border/50"
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Cor</p>
              <div className="flex gap-2 flex-wrap">
                {categoryColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setCatForm((f) => ({ ...f, color }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${catForm.color === color ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveCat}>{editingCat ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Excluir transação?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Essa ação não poderá ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteTx(deleteTarget)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;
