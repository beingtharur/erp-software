"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { titleCase } from "@/lib/format";

const stageOrder = ["NEW", "QUALIFIED", "QUOTATION_SENT", "NEGOTIATION", "WON", "LOST"];

const chartConfig = {
  value: {
    label: "Pipeline Value",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function PipelineChart({
  data,
}: {
  data: { stage: string; _count: number; _sum: { value: number | null } }[];
}) {
  const chartData = stageOrder
    .map((stage) => {
      const row = data.find((d) => d.stage === stage);
      return {
        stage: titleCase(stage),
        value: row?._sum.value ?? 0,
        count: row?._count ?? 0,
      };
    })
    .filter((d) => d.count > 0);

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis
          type="number"
          tickFormatter={(v) => `₹${(v / 10000000).toFixed(1)}Cr`}
          tickLine={false}
          axisLine={false}
          fontSize={11}
        />
        <YAxis
          type="category"
          dataKey="stage"
          tickLine={false}
          axisLine={false}
          width={100}
          fontSize={12}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{item.payload.count} leads</span>
                  <span className="font-mono font-medium">
                    ₹{(Number(value) / 10000000).toFixed(2)} Cr
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
