import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { EmptyState, ErrorState, Loading } from "@/components/feedback";
import { PanelHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFilters } from "@/lib/filters";
import type { AuditEntry, Page } from "@/lib/types";

const entities = new Map([
  ["lesson_days", "Diário de turma"],
  ["lessons", "Aula"],
  ["classroom_events", "Acontecimento de turma"],
  ["student_observations", "Observação de estudante"],
  ["attendances", "Frequência"],
  ["attendance_sessions", "Chamada"],
  ["uniform_checks", "Fardamento"],
  ["occurrences", "Registro acadêmico (RA)"],
  ["notifications", "Notificação"],
  ["referrals", "Encaminhamento"],
  ["classrooms", "Turma"],
  ["students", "Estudante"],
  ["guardians", "Responsável"],
  ["student_imports", "Importação de fichas"],
  ["student_nfc_cards", "Cartão NFC"],
  ["ra_codes", "Código RA"],
  ["settings", "Configuração"],
]);

const fields = new Map([
  ["classroom_id", "ID da turma"],
  ["student_id", "ID do estudante"],
  ["lesson_day_id", "ID do diário"],
  ["date", "Data do registro"],
  ["observed_on", "Data da observação"],
  ["occurred_on", "Data da ocorrência"],
  ["kind", "Categoria"],
  ["title", "Título"],
  ["description", "Descrição"],
  ["content", "Conteúdo"],
  ["period", "Período"],
  ["planned_lessons", "Aulas previstas"],
  ["subject", "Disciplina"],
  ["teacher_name", "Professor(a)"],
  ["progress", "Andamento"],
  ["start_time", "Horário de início"],
  ["note", "Nota"],
  ["notes", "Observações"],
]);

const actions = { create: "Criação", update: "Alteração", cancel: "Cancelamento" };
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "UTC",
});

function valueLabel(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function EntryDetails({ entry, label }: { entry: AuditEntry; label: string }) {
  const changes = Object.entries(entry.changes);
  const showPrevious = entry.action !== "create";
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Ver detalhes de ${label} #${entry.entity_id}`}>
          Detalhes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="pr-6">
          <DialogTitle>{label} #{entry.entity_id}</DialogTitle>
          <DialogDescription>
            {actions[entry.action]} · {dateTime.format(new Date(entry.created_at))} UTC
          </DialogDescription>
        </DialogHeader>
        {changes.length ? (
          <dl className="min-w-0 space-y-3">
            {changes.map(([field, change]) => (
              <div key={field} className="space-y-2 rounded-lg border p-3">
                <dt className="text-sm font-medium">{fields.get(field) ?? field.replaceAll("_", " ")}</dt>
                <dd className={`grid gap-3 ${showPrevious ? "sm:grid-cols-2" : ""}`}>
                  {(showPrevious ? [["Antes", change.old], ["Depois", change.new]] : [["Valor gravado", change.new]]).map(([caption, value]) => (
                    <div key={String(caption)} className="min-w-0 rounded-md bg-muted/50 p-2.5">
                      <p className="text-xs font-medium text-muted-foreground">{String(caption)}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm">{valueLabel(value)}</p>
                    </div>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        ) : <p className="text-sm text-muted-foreground">Nenhum campo detalhado na auditoria.</p>}
      </DialogContent>
    </Dialog>
  );
}

export default function Activity() {
  const { user } = useAuth();
  const allowed = user?.role === "admin" || user?.role === "coordenacao";
  const { classroomId, classrooms, from, to } = useFilters();
  const [params, setParams] = useSearchParams();
  const requestedType = params.get("tipo_atividade") ?? "";
  const entity = entities.has(requestedType) ? requestedType : "";
  const requestedPage = Number(params.get("page"));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const activity = useQuery({
    queryKey: ["activity", classroomId, from, to, entity, page],
    queryFn: ({ signal }) => api<Page<AuditEntry>>("/audit-logs", {
      query: { classroom_id: classroomId, from, to, entity, page, per_page: 25 },
      signal,
    }),
    enabled: allowed,
  });

  function update(key: "tipo_atividade" | "page", value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    }, { replace: true });
  }

  if (!allowed) return <EmptyState title="Acesso restrito à administração e à coordenação" />;
  const classroomNames = new Map(classrooms.map((item) => [item.id, `${item.name} · ${item.school_year}`]));

  return (
    <Card className="glass gap-0 overflow-hidden p-0">
      <div className="p-6 pb-0">
        <PanelHeading
          title="Histórico de gravações"
          description="O período filtra quando a gravação ocorreu, não a data do fato. A auditoria registra o autor, mas não distingue gravações do ChatGPT das demais."
          action={
            <select aria-label="Tipo de registro" className="filter-control min-w-44" value={entity} onChange={(event) => update("tipo_atividade", event.target.value)}>
              <option value="">Todos os tipos</option>
              {Array.from(entities, ([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          }
        />
      </div>
      {activity.isPending ? <Loading /> : activity.error ? (
        <div className="p-6"><ErrorState error={activity.error} retry={() => void activity.refetch()} /></div>
      ) : activity.data.data.length === 0 ? (
        <EmptyState title="Nenhuma gravação encontrada" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Registro</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Turma</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Gravado em (UTC)</TableHead>
              <TableHead className="pr-6 text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activity.data.data.map((entry) => {
              const label = entities.get(entry.entity) ?? entry.entity.replaceAll("_", " ");
              return (
                <TableRow key={entry.id}>
                  <TableCell className="py-4 pl-6">
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">Registro #{entry.entity_id}</div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{actions[entry.action]}</Badge></TableCell>
                  <TableCell>{entry.classroom_id === null ? "—" : classroomNames.get(entry.classroom_id) ?? `Turma #${entry.classroom_id}`}</TableCell>
                  <TableCell>{entry.user?.full_name ?? (entry.user_id ? `Usuário #${entry.user_id}` : "Não informado")}</TableCell>
                  <TableCell><time dateTime={entry.created_at}>{dateTime.format(new Date(entry.created_at))}</time></TableCell>
                  <TableCell className="pr-6 text-right"><EntryDetails entry={entry} label={label} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {activity.data && <Pagination meta={activity.data.meta} page={page} onChange={(next) => update("page", String(next))} />}
    </Card>
  );
}
