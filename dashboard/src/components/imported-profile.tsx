import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { api } from "@/lib/api";
import type { ImportedProfile as Profile } from "@/lib/import-types";
import { useAuth } from "@/lib/auth";
import { ErrorState, Loading } from "@/components/feedback";

export function ImportedProfile({ studentId }: { studentId: number }) {
  const { user } = useAuth();
  const result = useQuery({
    queryKey: ["imported-profile", studentId],
    queryFn: ({ signal }) =>
      api<{ profile: Profile | null }>(
        `/students/${studentId}/imported-profile`,
        { signal },
      ),
    enabled: user?.role === "admin",
  });
  if (user?.role !== "admin") return null;
  if (result.isPending) return <Loading label="Carregando ficha importada…" />;
  if (result.error)
    return (
      <ErrorState
        error={result.error}
        retry={() => {
          void result.refetch();
        }}
      />
    );
  const profile = result.data.profile;
  if (!profile) return null;
  return (
    <details
      className="mt-3 rounded-2xl border border-white/60 bg-white/25 p-4"
      open
    >
      <summary className="cursor-pointer text-sm font-semibold">
        <FileText className="mr-2 inline size-4" />
        Ficha cadastral importada
      </summary>
      <p className="mt-3 break-words text-xs leading-5 text-muted-foreground">
        {profile.source.filename} · Páginas {profile.source.pages.join(", ")} ·{" "}
        {profile.school_name} · {profile.school_year}
      </p>
      {profile.warnings.length > 0 && (
        <details className="mt-4 rounded-xl bg-amber-50/70 p-3">
          <summary className="cursor-pointer text-xs font-medium text-amber-900">
            {profile.warnings.length} aviso(s) de leitura e qualidade dos dados
          </summary>
          <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-5 text-amber-900">
            {profile.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-5 space-y-5">
        {profile.sections.map((section, index) => (
          <section key={`${section.key}-${index}`}>
            <h4 className="mb-3 text-xs font-semibold">{section.title}</h4>
            <dl className="grid gap-x-5 gap-y-3 rounded-xl bg-white/35 p-3 sm:grid-cols-2">
              {section.fields.map((field) => (
                <div key={field.key} className="min-w-0">
                  <dt className="text-[10px] leading-4 text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-1 break-words text-xs leading-5">
                    {typeof field.value === "boolean"
                      ? field.value
                        ? "Sim"
                        : "Não assinalado"
                      : (field.value ?? "Não informado")}
                    {field.raw_value && field.raw_value !== field.value && (
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        No PDF: {field.raw_value}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <details className="mt-5 rounded-xl bg-white/25 p-3">
        <summary className="cursor-pointer text-xs font-medium">
          Texto original extraído do documento
        </summary>
        <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
          Preservado para conferir campos e informações que não tenham sido
          normalizados.
        </p>
        {profile.source.text.map((text, index) => (
          <section key={profile.source.pages[index]} className="mt-4">
            <h5 className="mb-2 text-[10px] font-semibold">
              Página {profile.source.pages[index]}
            </h5>
            <pre className="whitespace-pre-wrap break-words font-sans text-[10px] leading-5 text-muted-foreground">
              {text}
            </pre>
          </section>
        ))}
      </details>
    </details>
  );
}
