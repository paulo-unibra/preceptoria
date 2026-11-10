import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  ClipboardList,
  Download,
  LoaderCircle,
  Phone,
} from "lucide-react";
import { useState } from "react";
import { api, downloadReport } from "@/lib/api";
import { useFilters } from "@/lib/filters";
import type { Student, StudentHistory } from "@/lib/types";
import { dateLabel, percentage } from "@/lib/utils";
import { StudentPhoto } from "@/components/student-photo";
import { ImportedProfile } from "@/components/imported-profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Loading } from "@/components/feedback";

export function StudentDetail({
  id,
  close,
}: {
  id: number | null;
  close: () => void;
}) {
  const { from, to } = useFilters();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const detail = useQuery({
    queryKey: ["student", id],
    queryFn: ({ signal }) =>
      api<{ student: Student }>(`/students/${id}`, { signal }),
    enabled: id !== null,
  });
  const history = useQuery({
    queryKey: ["history", id, from, to],
    queryFn: ({ signal }) =>
      api<StudentHistory>(`/students/${id}/history`, {
        query: { from, to },
        signal,
      }),
    enabled: id !== null,
  });
  const student = detail.data?.student;
  const totals = history.data?.totals;
  async function download() {
    setDownloading(true);
    setDownloadError("");
    try {
      await downloadReport(
        `/reports/students/${id}`,
        { from, to },
        `estudante-${id}-${from}-${to}.pdf`,
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Erro ao gerar relatório.",
      );
    } finally {
      setDownloading(false);
    }
  }
  return (
    <Dialog
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[92svh] overflow-y-auto overscroll-contain rounded-3xl border-white/70 bg-[#f8f3eb]/80 bg-linear-to-br from-white/35 to-transparent p-5 shadow-[0_32px_100px_-24px_#26170f80,inset_0_1px_0_#ffffffb3] backdrop-blur-2xl sm:max-w-5xl sm:p-8">
        <DialogHeader className="border-b border-white/50 pb-5 pr-6">
          <DialogTitle>Trajetória do estudante</DialogTitle>
          <DialogDescription>
            Acompanhamento de {dateLabel(from)} a {dateLabel(to)}.
          </DialogDescription>
        </DialogHeader>
        {detail.isPending ? (
          <Loading />
        ) : detail.error ? (
          <ErrorState
            error={detail.error}
            retry={() => {
              void detail.refetch();
            }}
          />
        ) : (
          student && (
            <>
              <div className="mt-2 flex items-center gap-4">
                <StudentPhoto
                  id={student.id}
                  name={student.full_name}
                  hasPhoto={student.has_photo}
                  className="h-20 w-16 rounded-xl text-lg"
                />
                <div className="min-w-0">
                  <h3 className="break-words text-xl font-semibold">{student.full_name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {student.classroom?.name ?? "Sem turma"} · Matrícula{" "}
                    {student.registration || "não informada"}
                  </p>
                </div>
              </div>
              <ImportedProfile studentId={student.id} />
              {student.tracking_notes && (
                <p className="rounded-2xl bg-white/40 p-4 text-sm leading-6">
                  {student.tracking_notes}
                </p>
              )}
              {history.error ? (
                <ErrorState
                  error={history.error}
                  retry={() => {
                    void history.refetch();
                  }}
                />
              ) : history.isPending ? (
                <Loading />
              ) : (
                totals && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/40 p-4">
                        <CalendarCheck className="mb-3 size-5 text-primary" />
                        <strong className="text-2xl">
                          {percentage(
                            totals.attendance.present + totals.attendance.late,
                            totals.attendance.records,
                          ) ?? "—"}
                          {totals.attendance.records > 0 && "%"}
                        </strong>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Frequência no período
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/40 p-4">
                        <ClipboardList className="mb-3 size-5 text-primary" />
                        <strong className="text-2xl">
                          {totals.occurrences.total}
                        </strong>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {totals.occurrences.positive} positivos ·{" "}
                          {totals.occurrences.negative} negativos
                        </p>
                      </div>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold">
                      Histórico do período
                    </h4>
                    {history.data?.items.length ? (
                      <ul className="space-y-3">
                        {history.data.items.slice(0, 50).map((item) => (
                          <li
                            key={`${item.type}-${item.id}`}
                            className="flex gap-3 rounded-xl bg-white/70 p-3"
                          >
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-[#ac937a]" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">{item.label}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {dateLabel(item.date)} ·{" "}
                                {item.status === "cancelled"
                                  ? "Cancelado"
                                  : "Registrado"}
                              </p>
                            </div>
                          </li>
                        ))}
                        {history.data.items.length > 50 && (
                          <li className="text-xs text-muted-foreground">
                            Exibindo os primeiros 50 registros. O PDF contém o
                            histórico completo.
                          </li>
                        )}
                      </ul>
                    ) : (
                      <EmptyState title="Nenhum registro no período" />
                    )}
                  </>
                )
              )}
              {student.guardians && student.guardians.length > 0 && (
                <>
                  <h4 className="mt-3 text-sm font-semibold">Responsáveis</h4>
                  {student.guardians.map((guardian) => (
                    <div
                      key={guardian.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {guardian.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {guardian.relationship || "Responsável"}
                          {guardian.is_primary && (
                            <Badge variant="secondary" className="ml-2">
                              Principal
                            </Badge>
                          )}
                        </p>
                      </div>
                      {guardian.phone && (
                        <a
                          href={`tel:${guardian.phone.replace(/[^\d+]/g, "")}`}
                          className="flex items-center gap-2 text-sm text-primary"
                        >
                          <Phone className="size-3.5" />
                          {guardian.phone}
                        </a>
                      )}
                    </div>
                  ))}
                </>
              )}
              <Button
                onClick={() => {
                  void download();
                }}
                disabled={downloading}
                className="mt-3"
              >
                {downloading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Download />
                )}
                Exportar histórico em PDF
              </Button>
              {downloadError && (
                <p role="alert" className="text-sm text-red-700">
                  {downloadError}
                </p>
              )}
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
