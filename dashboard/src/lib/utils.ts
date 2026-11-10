import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export { formatPhone } from "../../../src/lib/format";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const number = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
export function dateISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(`${value.slice(0, 10)}T12:00:00`),
  );
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .filter((_, i, parts) => i === 0 || i === parts.length - 1)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
export const percentage = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : null;
