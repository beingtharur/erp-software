"use client";

import { Pie, PieChart, Cell } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { titleCase } from "@/lib/format";

const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

const chartConfig = {
  count: { label: "Projects" },
} satisfies ChartConfig;

export function ProductLineChart({
  data,
}: {
  data: { productLine: string; _count: number }[];
}) {
  const chartData = data.map((d, i) => ({
    line: titleCase(d.productLine),
    count: d._count,
    fill: colors[i % colors.length],
  }));

  return (
    <ChartContainer config={chartConfig} className="mx-auto h-64 w-full max-w-64">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="line"
          innerRadius={55}
          strokeWidth={4}
          isAnimationActive={false}
        >
          {chartData.map((entry) => (
            <Cell key={entry.line} fill={entry.fill} />
          ))}
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="line" />}
          className="flex-wrap gap-2 text-xs"
        />
      </PieChart>
    </ChartContainer>
  );
}
