import { lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  Users,
} from "lucide-react";
import { useFilters } from "@/lib/filters";
import { buildTimeline, summarizeReports } from "@/lib/analytics";
import { number, percentage } from "@/lib/utils";
import { useReports } from "@/hooks/use-reports";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  ChartSkeleton,
  PageSkeleton,
} from "@/components/feedback";
import { PanelHeading } from "@/components/page-heading";

const AttendanceChart = lazy(() =>
  import("@/components/analytics-charts").then((module) => ({
    default: module.AttendanceChart,
  })),
);
const OccurrenceChart = lazy(() =>
  import("@/components/analytics-charts").then((module) => ({
    default: module.OccurrenceChart,
  })),
);

export default function Overview() {
  const { reports, loading, error, retry } = useReports();
  const { classrooms, classroomId, from, to } = useFilters();
  const [params] = useSearchParams();
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} retry={retry} />;
  if (!reports.length)
    return (
      <Card className="glass">
        <EmptyState
          title="Nenhuma turma disponível"
          description="Solicite à administração o vínculo às turmas que você acompanha."
        />
      </Card>
    );
  const totals = summarizeReports(reports);
  const students = classrooms
    .filter((item) => !classroomId || String(item.id) === classroomId)
    .reduce((sum, item) => sum + (item.students_count ?? 0), 0);
  const timeline = buildTimeline(reports, from, to);
  const metrics = [
    {
      label: "Estudantes acompanhados",
      value: number(students),
      caption: `${reports.length} turma${reports.length === 1 ? "" : "s"} no filtro`,
      icon: Users,
    },
    {
      label: "Frequência no período",
      value: totals.attendanceRate === null ? "—" : `${totals.attendanceRate}%`,
      caption: `${number(totals.present)} de ${number(totals.attendance)} registros`,
      icon: ClipboardCheck,
    },
    {
      label: "Registros acadêmicos",
      value: number(totals.occurrences),
      caption: `${number(totals.positive)} positivos · ${number(totals.negative)} negativos`,
      icon: BookOpen,
    },
    {
      label: "Encaminhamentos em aberto",
      value: number(totals.referrals),
      caption: `${number(totals.review)} RA(s) aguardando revisão`,
      icon: HeartHandshake,
    },
  ];
  return (
    <div className="space-y-4">
      <section
        aria-label="Indicadores do período"
        className="grid gap-3 min-[360px]:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map(({ label, value, caption, icon: Icon }) => (
          <Card key={label} className="glass min-w-0 gap-0 p-3 sm:p-4">
            <div className="flex min-h-9 items-center justify-between gap-2">
              <p className="text-xs leading-snug font-medium text-muted-foreground [overflow-wrap:anywhere]">{label}</p>
              <div className="kpi-icon">
                <Icon className="size-3.5" strokeWidth={1.7} />
              </div>
            </div>
            <strong className="mt-3 text-3xl leading-none font-semibold tracking-tight tabular-nums">
              {value}
            </strong>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">{caption}</p>
          </Card>
        ))}
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="glass min-w-0 gap-0 p-4 sm:p-5">
          <PanelHeading
            title="Evolução da frequência"
            description="Presenças (incluindo atrasos) e faltas por dia"
            action={
              <span className="status-pill">
                {totals.attendance
                  ? "Frequência registrada"
                  : "Sem chamada no período"}
              </span>
            }
          />
          <div className="mb-1 flex gap-5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-sm bg-[var(--chart-positive)]" />
              Presenças
            </span>
            <span className="flex items-center gap-2">
              <i className="size-2 rounded-sm bg-[var(--chart-negative)]" />
              Faltas
            </span>
          </div>
          {totals.attendance ? (
            <Suspense fallback={<div role="status"><span className="sr-only">Carregando gráfico de frequência…</span><ChartSkeleton /></div>}>
              <AttendanceChart data={timeline} />
            </Suspense>
          ) : (
            <EmptyState
              title="A chamada ainda não foi registrada"
              description="Assim que houver registros de frequência, a evolução aparecerá aqui."
            />
          )}
        </Card>
        <Card className="glass min-w-0 gap-0 p-4 sm:p-5">
          <PanelHeading
            title="Registros acadêmicos"
            description="Distribuição entre positivos e negativos"
          />
          <Suspense fallback={<div role="status"><span className="sr-only">Carregando gráfico de registros…</span><ChartSkeleton donut /></div>}>
            <OccurrenceChart
              positive={totals.positive}
              negative={totals.negative}
            />
          </Suspense>
        </Card>
      </div>
      <Card className="glass gap-0 overflow-hidden p-0">
        <div className="px-6 pt-6">
          <PanelHeading
            title="Resumo por turma"
            description="Indicadores consolidados do período selecionado"
            action={
              <Button asChild variant="ghost" className="text-xs text-primary">
                <Link
                  to={{ pathname: "/relatorios", search: params.toString() }}
                >
                   Ver relatórios
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            }
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Turma</TableHead>
              <TableHead>Frequência</TableHead>
              <TableHead>RAs positivos</TableHead>
              <TableHead>RAs negativos</TableHead>
              <TableHead>Aulas registradas</TableHead>
              <TableHead className="pr-6 text-right">Acompanhamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => {
              const attendance = report.totals.attendance;
              const rate = percentage(
                attendance.present + attendance.late,
                attendance.records,
              );
              const pending =
                report.totals.referrals.open +
                report.totals.referrals.in_progress;
              const studentParams = new URLSearchParams(params);
              studentParams.set("classroom", String(report.classroom.id));
              return (
                <TableRow key={report.classroom.id}>
                  <TableCell className="py-4 pl-6">
                    <Link
                      to={{
                        pathname: "/estudantes",
                        search: studentParams.toString(),
                      }}
                      className="group flex items-center gap-3"
                    >
                      <span className="soft-icon">
                        <GraduationCap className="size-4" />
                      </span>
                      <span>
                        <strong className="text-xs font-semibold group-hover:text-primary">
                          {report.classroom.name}
                        </strong>
                        <span className="mt-1 block text-[10px] text-muted-foreground">
                          Ano letivo {report.classroom.school_year}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="w-24">
                      <span className="text-xs font-medium">
                        {rate === null ? "Sem registros" : `${rate}%`}
                      </span>
                       <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                           className="h-full rounded-full bg-primary"
                          style={{ width: `${rate ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
                      <ArrowUpRight className="size-3.5" />
                      {number(report.totals.occurrences.positive)}
                    </span>
                  </TableCell>
                  <TableCell>
                     <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                      <ArrowDownRight className="size-3.5" />
                      {number(report.totals.occurrences.negative)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {number(report.lessons.registered_lessons)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Badge
                      variant="secondary"
                      className={
                        pending
                          ? "bg-amber-50 text-amber-800"
                           : ""
                      }
                    >
                      {pending
                        ? `${pending} encaminhamento(s)`
                        : "Sem encaminhamentos abertos"}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
