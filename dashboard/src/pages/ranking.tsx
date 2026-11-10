import { useQuery } from "@tanstack/react-query";
import { Medal, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import type { RankingResponse } from "@/lib/types";
import { useFilters } from "@/lib/filters";
import { dateLabel, initials, number } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PanelHeading } from "@/components/page-heading";
import { EmptyState, ErrorState, Loading } from "@/components/feedback";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Ranking() {
  const { classroomId, classrooms, to } = useFilters();
  const ranking = useQuery({
    queryKey: ["ranking", classroomId, to],
    queryFn: ({ signal }) =>
      api<RankingResponse>("/ranking", {
        query: { classroom_id: classroomId, kind: "weekly", end: to },
        signal,
      }),
  });
  if (ranking.isPending) return <Loading />;
  if (ranking.error)
    return (
      <ErrorState
        error={ranking.error}
        retry={() => {
          void ranking.refetch();
        }}
      />
    );
  const result = ranking.data;
  return (
    <div className="space-y-6">
      <div className="glass flex items-center gap-4 p-6">
        <div className="soft-icon">
          <Trophy className="size-6" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-base font-semibold">
            Pequenas conquistas. Grandes trajetórias.
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            Destaques semanais de {dateLabel(result.period.from)} a{" "}
            {dateLabel(result.period.to)}. O ranking usa a janela semanal definida
            pela API, encerrada na data final selecionada.
          </p>
        </div>
      </div>
      {result.data.length > 0 && (
        <section
          aria-label="Destaques da semana"
          className="grid gap-5 sm:grid-cols-3"
        >
          {result.data.slice(0, 3).map((entry, index) => (
            <Card
              key={entry.student.id}
              className="glass relative items-center gap-3 p-7 text-center"
            >
              <Badge
                variant="secondary"
                className="absolute top-5 left-5 bg-white/45 text-primary"
              >
                #{entry.position}
              </Badge>
              <Medal
                className={
                  index === 0 ? "size-7 text-[#c38b49]" : "size-7 text-[#a89784]"
                }
                strokeWidth={1.5}
              />
              <span className="avatar size-16 text-xl">
                {initials(entry.student.full_name)}
              </span>
              <h3 className="mt-1 text-sm font-semibold">
                {entry.student.full_name}
              </h3>
              <p className="text-xs text-muted-foreground">
                {classrooms.find(
                  (item) => item.id === entry.student.classroom_id,
                )?.name || "Turma não informada"}
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-primary">
                {number(entry.score)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  pontos
                </span>
              </p>
            </Card>
          ))}
        </section>
      )}
      <Card className="glass gap-0 overflow-hidden p-0">
        <div className="px-6 pt-6">
          <PanelHeading
            title="Reconhecer para incentivar"
            description="Pontuação e critérios calculados pelo servidor."
          />
        </div>
        {result.data.length === 0 ? (
          <EmptyState
            title="Ainda não há destaques nesta semana"
            description="Selecione outra data final para consultar o ranking de outro período."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Posição</TableHead>
                <TableHead>Estudante</TableHead>
                <TableHead>RAs + / −</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Fardamento</TableHead>
                <TableHead className="pr-6 text-right">Pontos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.map((entry) => (
                <TableRow key={entry.student.id}>
                  <TableCell className="py-5 pl-6 text-sm font-medium text-primary">
                    #{entry.position}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {entry.student.full_name}
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.breakdown.positive_ras} /{" "}
                    {entry.breakdown.negative_ras}
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.breakdown.attendance_rate === null
                      ? "—"
                      : `${number(entry.breakdown.attendance_rate * 100)}%`}
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.breakdown.uniform_rate === null
                      ? "—"
                      : `${number(entry.breakdown.uniform_rate * 100)}%`}
                  </TableCell>
                  <TableCell className="pr-6 text-right text-sm font-semibold">
                    {number(entry.score)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Card className="glass gap-4 p-6">
        <PanelHeading
          title="Critérios transparentes"
          description="Pesos configurados pela administração da escola."
        />
        <div className="flex flex-wrap gap-3">
          {Object.entries(result.criteria.weights).map(([key, value]) => (
            <Badge
              key={key}
              variant="secondary"
              className="bg-white/80 px-3 py-2 font-normal text-muted-foreground"
            >
              {{
                positive_ra: "RA positivo",
                negative_ra: "RA negativo",
                attendance_rate: "Frequência",
                uniform_rate: "Fardamento",
                progress: "Progresso",
              }[key] ?? key}
              <strong className="ml-2 font-semibold text-foreground">
                {number(value)}
              </strong>
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
