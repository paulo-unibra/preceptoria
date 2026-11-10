import { useState } from "react";
import {
  Download,
  FileChartColumn,
  GraduationCap,
  LoaderCircle,
} from "lucide-react";
import { downloadReport } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import type { Classroom } from "@/lib/types";
import { dateLabel } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/feedback";

function ReportCard({
  classroom,
  from,
  to,
}: {
  classroom: Classroom;
  from: string;
  to: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    try {
      await downloadReport(
        `/reports/classrooms/${classroom.id}`,
        { from, to, include_items: true },
        `turma-${classroom.id}-${from}-${to}.pdf`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o relatório.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="glass gap-0 p-6">
      <div className="flex items-start justify-between">
        <span className="soft-icon">
          <FileChartColumn className="size-6" strokeWidth={1.5} />
        </span>
        <Badge
          variant="secondary"
          className="bg-white/70 text-muted-foreground"
        >
          PDF
        </Badge>
      </div>
      <h2 className="mt-6 text-lg font-semibold">{classroom.name}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Ano letivo {classroom.school_year}
        {classroom.shift ? ` · ${classroom.shift}` : ""}
      </p>
      <p className="mt-5 text-sm leading-6 text-muted-foreground">
        Frequência, fardamento, aulas, registros acadêmicos e encaminhamentos
        consolidados.
      </p>
      <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <GraduationCap className="size-4 text-[#9c8068]" />
        {classroom.students_count ?? 0} estudantes ativos
      </p>
      <Button
        variant="outline"
        className="mt-6 w-full text-primary"
        disabled={busy}
        onClick={() => {
          void download();
        }}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Download />}
        {busy ? "Preparando relatório…" : "Baixar relatório"}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          {error}
        </p>
      )}
    </Card>
  );
}

export default function Reports() {
  const { classrooms, classroomId, from, to } = useFilters();
  const selected = classrooms.filter(
    (item) => !classroomId || String(item.id) === classroomId,
  );
  return (
    <div className="space-y-6">
      <div className="glass p-6">
        <h2 className="text-base font-semibold">
          Informação pronta para fazer a diferença.
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Exporte o acompanhamento de {dateLabel(from)} a {dateLabel(to)} com a
          identidade visual da escola. Os PDFs são gerados pela mesma API do
          aplicativo.
        </p>
      </div>
      {selected.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {selected.map((classroom) => (
            <ReportCard
              key={classroom.id}
              classroom={classroom}
              from={from}
              to={to}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhuma turma disponível" />
      )}
    </div>
  );
}
