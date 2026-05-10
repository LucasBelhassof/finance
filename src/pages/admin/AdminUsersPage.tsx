import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminUsers } from "@/hooks/use-admin";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function AdminUsersPage() {
  const { data, isLoading } = useAdminUsers();

  return (
    <AdminLayout title="Usuários" description="Listagem inicial da base com status, papel, premium e última sessão.">
      <Card>
        <CardHeader>
          <CardTitle>Base de usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="hidden sm:table-cell">Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Plano</TableHead>
                <TableHead className="hidden lg:table-cell">Última sessão</TableHead>
                <TableHead className="hidden md:table-cell">Transações</TableHead>
                <TableHead>Total liquido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.users ?? []).map((user) => (
                <TableRow key={String(user.id)}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                        {user.transactionCount} transações
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant={user.isPremium ? "default" : "outline"}>
                      {user.isPremium ? "premium" : "free"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {user.lastSessionAt ? new Date(user.lastSessionAt).toLocaleString("pt-BR") : "Sem sessão"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{user.transactionCount}</TableCell>
                  <TableCell>{currencyFormatter.format(user.netTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isLoading && (data?.users?.length ?? 0) === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum usuário encontrado para os filtros atuais.</p>
          ) : null}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
