import { useQuery } from "@tanstack/react-query";
import { apiBlob } from "@/lib/api";
import { cn, initials } from "@/lib/utils";

export function StudentPhoto({
  id,
  name,
  hasPhoto,
  className,
}: {
  id: number;
  name: string;
  hasPhoto: boolean;
  className?: string;
}) {
  const photo = useQuery({
    queryKey: ["student-photo", id],
    queryFn: async ({ signal }) => {
      const blob = await apiBlob(`/students/${id}/photo`, signal);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Não foi possível abrir a foto."));
        reader.readAsDataURL(blob);
      });
    },
    enabled: hasPhoto,
    retry: false,
    staleTime: 5 * 60_000,
  });
  return photo.data ? (
    <img
      src={photo.data}
      alt={`Foto de ${name}`}
      className={cn(
        "size-10 shrink-0 rounded-full border-2 border-white/60 object-cover object-top",
        className,
      )}
    />
  ) : (
    <span className={cn("avatar", className)}>{initials(name)}</span>
  );
}
