import { useRef, useState } from "react";
import { Navigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCheck,
  FileText,
  Image,
  LoaderCircle,
  Upload,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ImportListEntry, StudentImportResult } from "@/lib/import-types";
import { Card } from "@/components/ui/card";
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
import { EmptyState, ErrorState } from "@/components/feedback";
import { PanelHeading } from "@/components/page-heading";
import { StudentDetail } from "@/components/student-detail";

const actions = {
  created: "Criado",
  updated: "Atualizado",
  unchanged: "Já cadastrado",
  conflict: "Conferir matrícula",
};

export default function Imports() {
  const { user } = useAuth();
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");
  const [result, setResult] = useState<StudentImportResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const recent = useQuery({
    queryKey: ["student-imports"],
    queryFn: ({ signal }) =>
      api<{ data: ImportListEntry[] }>("/imports/students", { signal }),
    enabled: user?.role === "admin",
  });
  const upload = useMutation({
    mutationFn: (selectedFile: File) => {
      const body = new FormData();
      body.set("file", selectedFile);
      return api<StudentImportResult>("/imports/students", {
        method: "POST",
        body,
        timeoutMs: 150_000,
      });
    },
    onSuccess: async (data) => {
      setResult(data);
      await client.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "me",
      });
    },
    retry: false,
  });

  if (user?.role !== "admin") return <Navigate to="/" replace />;
  function chooseFile(value: File | null) {
    upload.reset();
    setResult(null);
    setValidationError("");
    if (
      value &&
      (!value.name.toLowerCase().endsWith(".pdf") ||
        value.size > 20 * 1024 * 1024)
    ) {
      setValidationError("Selecione um arquivo PDF de até 20 MB.");
      setFile(null);
      return;
    }
    setFile(value);
  }
  async function openImport(id: number) {
    setOpening(id);
    setValidationError("");
    try {
      setResult(await api<StudentImportResult>(`/imports/students/${id}`));
    } catch (error) {
      setValidationError(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a importação.",
      );
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="glass gap-5 p-5 sm:p-6">
        <PanelHeading
          title="Do documento para cada trajetória"
          description="Importe fichas de estudantes SGGE / Sicap em PDF."
          action={
            <Badge variant="secondary" className="bg-white/40">
              Administração
            </Badge>
          }
        />
        <div className="grid items-start gap-6 xl:grid-cols-[1.3fr_1fr]">
          <div>
            <div
              className="relative flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/80 bg-white/25 p-5 text-center transition-colors hover:bg-white/40 focus-within:ring-2 focus-within:ring-ring"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!upload.isPending)
                  chooseFile(event.dataTransfer.files[0] ?? null);
              }}
            >
              <span className="soft-icon mb-4">
                <Upload className="size-6" strokeWidth={1.5} />
              </span>
              <label htmlFor="student-pdf" className="text-sm font-medium">
                Arraste o PDF ou clique para selecionar
              </label>
              <p
                id="file-help"
                className="mt-2 text-xs leading-5 text-muted-foreground"
              >
                Até 20 MB · Até 300 páginas · Fichas com texto selecionável
              </p>
              <input
                ref={fileInput}
                id="student-pdf"
                type="file"
                accept=".pdf,application/pdf"
                aria-describedby="file-help"
                disabled={upload.isPending}
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
              />
            </div>
            {file && (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/35 p-3">
                <FileText className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xs font-medium">{file.name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover arquivo"
                  disabled={upload.isPending}
                  onClick={() => {
                    chooseFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
            <Button
              className="mt-4 w-full sm:w-auto"
              disabled={!file || upload.isPending}
              onClick={() => {
                if (file) upload.mutate(file);
              }}
            >
              {upload.isPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Upload />
              )}
              {upload.isPending ? "Processando fichas…" : "Importar estudantes"}
            </Button>
            {upload.isPending && (
              <p
                role="status"
                className="mt-3 text-xs leading-6 text-muted-foreground"
              >
                Lendo o documento, extraindo fotos e armazenando as fichas. O
                processamento pode levar alguns instantes. Se a conexão cair,
                reenviar o mesmo PDF não duplica os alunos.
              </p>
            )}
          </div>
          <div className="space-y-4 rounded-2xl bg-white/20 p-5 text-xs leading-6 text-muted-foreground">
            <h3 className="text-sm font-medium text-foreground">
              Como funciona
            </h3>
            <p>
              <strong className="text-foreground">
                01. Turma pelo arquivo.
              </strong>{" "}
              Use o padrão{" "}
              <span className="break-words font-medium">
                FICHA DO ESTUDANTE_9º ANO A.pdf
              </span>
              . A turma será criada se não existir no ano letivo do PDF.
            </p>
            <p>
              <strong className="text-foreground">
                02. Matrícula sem duplicação.
              </strong>{" "}
              Alunos existentes são identificados pela matrícula. Conflitos de
              nome ou turma são sinalizados, sem reenturmação automática.
            </p>
            <p>
              <strong className="text-foreground">
                03. Ficha completa e foto.
              </strong>{" "}
              Identificação, responsáveis, documentos, endereço, saúde e
              informações escolares são armazenados. Fotos são extraídas quando
              presentes; os campos inconsistentes mantêm o valor original para
              conferência.
            </p>
            <p className="flex items-start gap-2">
              <Image className="mt-1 size-4" />
              Fotos já cadastradas são preservadas. A importação não depende dos
              filtros de turma e período do dashboard.
            </p>
          </div>
        </div>
        {validationError && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900"
          >
            <AlertCircle className="size-4" />
            {validationError}
          </p>
        )}
        {upload.error && (
          <ErrorState
            error={upload.error}
            retry={() => {
              if (file) upload.mutate(file);
            }}
          />
        )}
      </Card>

      {result && (
        <Card className="glass gap-0 overflow-hidden p-0">
          <div className="p-5 sm:p-6">
            <PanelHeading
              title={
                result.already_imported
                  ? "Este arquivo já foi importado"
                  : "Importação concluída"
              }
              description={`${result.classroom.name} · Ano letivo ${result.classroom.school_year} · ${result.pages} páginas`}
              action={<CheckCheck className="size-6 text-emerald-700" />}
            />
            <p className="mb-5 break-words text-xs text-muted-foreground">
              {result.filename}
              {result.classroom_created
                ? " · Turma criada nesta importação."
                : " · Turma existente reutilizada."}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ["Estudantes", result.total],
                ["Criados", result.created],
                ["Atualizados", result.updated],
                ["Já cadastrados", result.unchanged],
                ["Fotos extraídas", result.photos_found],
                ["Conflitos", result.conflicts],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/30 p-3">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <strong className="mt-2 block text-2xl font-medium">
                    {value}
                  </strong>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">
              {result.already_imported
                ? "Resultado original recuperado. Nenhum cadastro foi duplicado."
                : `${result.photos_saved} foto(s) adicionada(s) aos cadastros.`}{" "}
              A ficha completa está disponível no detalhe de cada estudante.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Estudante</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Foto</TableHead>
                <TableHead>Conferência</TableHead>
                <TableHead className="pr-6 text-right">Ficha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.registration}>
                  <TableCell className="py-4 pl-6 text-xs font-medium">
                    {row.full_name}
                  </TableCell>
                  <TableCell className="text-xs">{row.registration}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        row.action === "conflict"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-white/40"
                      }
                    >
                      {actions[row.action]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.has_photo ? "Disponível" : "Sem foto"}
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal text-xs text-muted-foreground">
                    {row.warnings.length ? (
                      <details>
                        <summary className="cursor-pointer">
                          {row.warnings.length} aviso(s)
                        </summary>
                        <ul className="mt-2 list-disc space-y-2 pl-3 text-[11px] leading-5">
                          {row.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </details>
                    ) : (
                      "Sem avisos"
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Abrir ficha de ${row.full_name}`}
                      disabled={row.student_id === null}
                      onClick={() => setSelected(row.student_id)}
                    >
                      <ArrowUpRight className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card className="glass gap-4 p-5 sm:p-6">
        <PanelHeading
          title="Últimas importações"
          description="Histórico dos últimos 20 arquivos processados."
        />
        {recent.error ? (
          <ErrorState
            error={recent.error}
            retry={() => {
              void recent.refetch();
            }}
          />
        ) : recent.data?.data.length ? (
          <ul className="divide-y divide-white/25">
            {recent.data.data.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-3">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xs font-medium">
                    {entry.filename}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {entry.students_count} estudante(s) · Ano{" "}
                    {entry.school_year} ·{" "}
                    {new Date(entry.created_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={opening !== null}
                  onClick={() => {
                    void openImport(entry.id);
                  }}
                >
                  {opening === entry.id ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <>
                      Ver resultado
                      <ArrowUpRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        ) : recent.isPending ? (
          <p role="status" className="text-xs text-muted-foreground">
            Carregando importações…
          </p>
        ) : (
          <EmptyState
            title="Sua primeira importação começa aqui"
            description="Os arquivos processados aparecerão nesta lista."
          />
        )}
      </Card>
      <StudentDetail
        key={selected ?? "closed"}
        id={selected}
        close={() => setSelected(null)}
      />
    </div>
  );
}
