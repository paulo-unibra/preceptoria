import {
  Area,
  AreaChart,
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
  border: "1px solid rgba(255,255,255,.6)",
  borderRadius: 16,
  background: "rgba(248,242,234,.96)",
  boxShadow: "0 12px 35px #523c2912",
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
        <AreaChart
          data={data}
          margin={{ top: 16, right: 5, left: -25, bottom: 0 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient
              id="attendance-gradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#e77656" stopOpacity={0.28} />
              <stop offset="95%" stopColor="#e77656" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="absence-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#625a50" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#625a50" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#8b756219"
            strokeDasharray="2 6"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "#7a6b5c" }}
            minTickGap={28}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "#7a6b5c" }}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ stroke: "#baa591", strokeDasharray: "4 4" }}
          />
          <Area
            name="Presenças"
            type="monotone"
            dataKey="presentes"
            stroke="#e77656"
            strokeWidth={2}
            fill="url(#attendance-gradient)"
            isAnimationActive={false}
          />
          <Area
            name="Faltas"
            type="monotone"
            dataKey="faltas"
            stroke="#625a50"
            strokeWidth={1.5}
            fill="url(#absence-gradient)"
            isAnimationActive={false}
          />
        </AreaChart>
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
              {["#449e87", "#e77656"].map((color) => (
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
      <div className="grid grid-cols-2 divide-x divide-white/35 text-center">
        {data.map((item, i) => (
          <div key={item.name}>
            <p className="mb-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span
                className={`size-1.5 rounded-full ${i === 0 ? "bg-[#449e87]" : "bg-[#e77656]"}`}
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
