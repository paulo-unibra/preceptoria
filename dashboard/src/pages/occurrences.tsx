import { useState } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { Occurrence, Page } from "@/lib/types";
import { useFilters } from "@/lib/filters";
import { dateLabel } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PanelHeading } from "@/components/page-heading";
import { Pagination } from "@/components/pagination";
import { EmptyState, ErrorState, Loading } from "@/components/feedback";

export default function Occurrences() {
  const { classroomId, classrooms, from, to } = useFilters();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const query = useDebounce(search.trim());
  const polarity = params.get("polarity") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const occurrences = useQuery({
    queryKey: ["occurrences", classroomId, from, to, polarity, query, page],
    queryFn: ({ signal }) =>
      api<Page<Occurrence>>("/occurrences", {
        query: {
          classroom_id: classroomId,
          from,
          to,
          polarity,
          q: query,
          page,
          per_page: 15,
        },
        signal,
      }),
  });
  function update(key: string, value: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(key, value);
        if (key !== "page") next.delete("page");
        return next;
      },
      { replace: true },
    );
  }
  return (
    <>
      <Card className="glass gap-0 overflow-hidden p-0">
        <div className="p-6 pb-0">
          <PanelHeading
            title="Registros acadêmicos"
            description="RAs ativos, com a polaridade definida pela API."
            action={
              <div className="flex flex-wrap gap-3">
                <select
                  aria-label="Filtrar polaridade"
                  className="filter-control min-w-40"
                  value={polarity}
                  onChange={(event) => update("polarity", event.target.value)}
                >
                  <option value="">Todos os RAs</option>
                  <option value="positive">Positivos</option>
                  <option value="negative">Negativos</option>
                </select>
                <div className="relative">
                  <Search className="absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label="Buscar na descrição das ocorrências"
                    placeholder="Buscar descrição…"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      update("page", "1");
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
            }
          />
        </div>
        {occurrences.isPending ? (
          <Loading />
        ) : occurrences.error ? (
          <div className="p-6">
            <ErrorState
              error={occurrences.error}
              retry={() => {
                void occurrences.refetch();
              }}
            />
          </div>
        ) : occurrences.data.data.length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Estudante / registro</TableHead>
                <TableHead>Data do fato</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conferência</TableHead>
                <TableHead className="pr-6 text-right">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {occurrences.data.data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-80 py-5 pl-6">
                    <p className="text-xs font-medium">
                      {item.student?.full_name ||
                        `Estudante #${item.student_id}`}
                    </p>
                    <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                      RA {String(item.ra_code).padStart(2, "0")} ·{" "}
                      {item.description}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {dateLabel(item.occurred_on)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {classrooms.find(
                      (classroom) => classroom.id === item.classroom_id,
                    )?.name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        item.polarity === "positive"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }
                    >
                      {item.polarity === "positive" ? "Positivo" : "Negativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.needs_review ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-50 text-amber-800"
                      >
                        Revisão pendente
                      </Badge>
                    ) : (
                      "Sem pendências"
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Ver RA ${item.id} de ${item.student?.full_name || "estudante"}`}
                      onClick={() => setSelected(item)}
                    >
                      <ArrowUpRight className="size-4 text-primary" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {occurrences.data && (
          <Pagination
            meta={occurrences.data.meta}
            page={page}
            onChange={(value) => update("page", String(value))}
          />
        )}
      </Card>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              RA {String(selected?.ra_code ?? "").padStart(2, "0")} ·{" "}
              {selected?.student?.full_name}
            </DialogTitle>
            <DialogDescription>
              {selected &&
                `Fato em ${dateLabel(selected.occurred_on)} · Cadastro em ${dateLabel(selected.created_at)}`}
            </DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm leading-7">
            {selected?.description}
          </p>
          {selected?.context && (
            <div className="rounded-2xl bg-white/40 p-4">
              <h3 className="text-xs font-semibold">Contexto</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {selected.context}
              </p>
            </div>
          )}
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Relatado por</dt>
              <dd className="mt-1">
                {selected?.reported_by_name || "Não informado"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Aula</dt>
              <dd className="mt-1">
                {selected?.lesson_period
                  ? `${selected.lesson_period}ª aula`
                  : "Não informada"}
              </dd>
            </div>
          </dl>
          {selected?.needs_review && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">
              Este registro precisa de conferência pela equipe responsável.
              {selected.polarity_divergent && " Há divergência na polaridade."}
              {selected.possible_duplicate_of_id &&
                " Possível duplicidade identificada."}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
