import type { ClassroomReport } from "@/lib/types";
import { dateISO, dateLabel, percentage } from "@/lib/utils";

export function summarizeReports(reports: ClassroomReport[]) {
  const attendance = reports.reduce(
    (sum, report) => sum + report.totals.attendance.records,
    0,
  );
  const present = reports.reduce(
    (sum, report) =>
      sum + report.totals.attendance.present + report.totals.attendance.late,
    0,
  );
  return {
    attendance,
    present,
    absent: reports.reduce(
      (sum, report) => sum + report.totals.attendance.absent,
      0,
    ),
    late: reports.reduce(
      (sum, report) => sum + report.totals.attendance.late,
      0,
    ),
    attendanceRate: percentage(present, attendance),
    occurrences: reports.reduce(
      (sum, report) => sum + report.totals.occurrences.total,
      0,
    ),
    positive: reports.reduce(
      (sum, report) => sum + report.totals.occurrences.positive,
      0,
    ),
    negative: reports.reduce(
      (sum, report) => sum + report.totals.occurrences.negative,
      0,
    ),
    review: reports.reduce(
      (sum, report) => sum + report.totals.occurrences.needs_review,
      0,
    ),
    referrals: reports.reduce(
      (sum, report) =>
        sum +
        report.totals.referrals.open +
        report.totals.referrals.in_progress,
      0,
    ),
    lessons: reports.reduce(
      (sum, report) => sum + report.lessons.registered_lessons,
      0,
    ),
  };
}

export function buildTimeline(
  reports: ClassroomReport[],
  from: string,
  to: string,
) {
  const days = new Map<
    string,
    {
      date: string;
      label: string;
      presentes: number;
      faltas: number;
      positivos: number;
      negativos: number;
    }
  >();
  const cursor = new Date(`${from}T12:00:00`);
  while (dateISO(cursor) <= to) {
    const date = dateISO(cursor);
    days.set(date, {
      date,
      label: dateLabel(date),
      presentes: 0,
      faltas: 0,
      positivos: 0,
      negativos: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const report of reports)
    for (const student of report.students)
      for (const item of student.items ?? []) {
        const day = days.get(item.date.slice(0, 10));
        if (!day || item.status === "cancelled") continue;
        if (item.type === "attendance") {
          if (item.data.status === "present" || item.data.status === "late")
            day.presentes++;
          if (item.data.status === "absent") day.faltas++;
        }
        if (item.type === "occurrence") {
          if (item.data.polarity === "positive") day.positivos++;
          if (item.data.polarity === "negative") day.negativos++;
        }
      }
  return [...days.values()];
}
