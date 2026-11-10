import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { Page, Student } from "@/lib/types";
import { useFilters } from "@/lib/filters";
import { useAuth } from "@/lib/auth";
import { StudentPhoto } from "@/components/student-photo";
import { useDebounce } from "@/hooks/use-debounce";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { StudentDetail } from "@/components/student-detail";
import { EmptyState, ErrorState, Loading } from "@/components/feedback";

export default function Students() {
  const { classroomId } = useFilters();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const query = useDebounce(search.trim());
  const page = Math.max(1, Number(params.get("page")) || 1);
  const students = useQuery({
    queryKey: ["students", classroomId, query, page],
    queryFn: ({ signal }) =>
      api<Page<Student>>("/students", {
        query: { classroom_id: classroomId, q: query, page, per_page: 15 },
        signal,
      }),
  });
  function setPage(value: number) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set("page", String(value));
        return next;
      },
      { replace: true },
    );
  }
  return (
    <>
      {user?.role === "admin" && (
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link to="/importacoes">
              <Upload className="size-4" />
              Importar fichas em PDF
            </Link>
          </Button>
        </div>
      )}
      <Card className="glass gap-0 overflow-hidden p-0">
        <div className="p-6 pb-0">
          <PanelHeading
            title="Cada nome, uma história"
            description="Matrículas ativas. O filtro de período se aplica ao histórico individual."
            action={
              <div className="relative w-full sm:w-72">
                <Search className="absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Buscar estudante por nome ou matrícula"
                  placeholder="Buscar nome ou matrícula…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            }
          />
        </div>
        {students.isPending ? (
          <Loading />
        ) : students.error ? (
          <div className="p-6">
            <ErrorState
              error={students.error}
              retry={() => {
                void students.refetch();
              }}
            />
          </div>
        ) : students.data.data.length === 0 ? (
          <EmptyState
            title="Nenhum estudante encontrado"
            description="Confira a busca ou selecione outra turma."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Estudante</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="pr-6 text-right">Trajetória</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.data.data.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="py-4 pl-6">
                    <div className="flex items-center gap-3">
                      <StudentPhoto
                        id={student.id}
                        name={student.full_name}
                        hasPhoto={student.has_photo}
                        className="size-9 text-[10px]"
                      />
                      <span className="text-xs font-medium">
                        {student.full_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {student.registration || "Não informada"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {student.classroom?.name || "Sem turma"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="bg-emerald-50 text-emerald-700"
                    >
                      Ativo
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-primary"
                      onClick={() => setSelected(student.id)}
                    >
                      Ver histórico
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {students.data && (
          <Pagination
            meta={students.data.meta}
            page={page}
            onChange={setPage}
          />
        )}
      </Card>
      <StudentDetail
        key={selected ?? "closed"}
        id={selected}
        close={() => setSelected(null)}
      />
    </>
  );
}
