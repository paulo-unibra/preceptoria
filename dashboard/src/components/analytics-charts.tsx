import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/feedback";
import { number } from "@/lib/utils";

const tooltipStyle = {
  border: "1px solid #e2e7e3",
  borderRadius: 10,
  background: "#fff",
  boxShadow: "0 6px 20px #18211d14",
  fontSize: 12,
};
export function AttendanceChart({
  data,
}: {
  data: { label: string; presentes: number; faltas: number }[];
}) {
  return (
    <div
      className="h-52 w-full sm:h-56"
      role="img"
      aria-label={`Frequência no período: ${data.reduce((sum, item) => sum + item.presentes, 0)} presenças e ${data.reduce((sum, item) => sum + item.faltas, 0)} faltas. Os totais por turma estão na tabela abaixo.`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={data}
          margin={{ top: 16, right: 5, left: -25, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid
            stroke="#e2e7e3"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#5b665f" }}
            minTickGap={28}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#5b665f" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "#edf3ee" }}
          />
          <Bar
            name="Presenças"
            dataKey="presentes"
            fill="var(--chart-positive)"
            maxBarSize={24}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            name="Faltas"
            dataKey="faltas"
            fill="var(--chart-negative)"
            maxBarSize={24}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OccurrenceChart({
  positive,
  negative,
}: {
  positive: number;
  negative: number;
}) {
  const total = positive + negative;
  if (!total)
    return (
      <EmptyState
        title="Nenhum RA no período"
        description="Os registros positivos e negativos aparecerão aqui."
      />
    );
  const data = [
    { name: "Positivos", value: positive },
    { name: "Negativos", value: negative },
  ];
  return (
    <>
      <div
        className="relative mx-auto h-44 w-full max-w-64"
        role="img"
        aria-label={`${positive} RAs positivos e ${negative} negativos`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={57}
              outerRadius={76}
              paddingAngle={total && positive && negative ? 3 : 0}
              stroke="none"
              cornerRadius={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {["var(--chart-positive)", "var(--chart-negative)"].map((color) => (
                <Cell key={color} fill={color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-[27px] font-medium tracking-tight">
            {number(total)}
          </strong>
          <span className="mt-1 text-[9px] text-muted-foreground">
            registros no período
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border text-center">
        {data.map((item, i) => (
          <div key={item.name}>
            <p className="mb-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span
                  className={`size-2 rounded-sm ${i === 0 ? "bg-[var(--chart-positive)]" : "bg-[var(--chart-negative)]"}`}
              />
              {item.name}
            </p>
            <strong className="text-lg font-semibold">
              {number(item.value)}
            </strong>
            <span className="ml-2 text-xs text-muted-foreground">
              {Math.round((item.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
