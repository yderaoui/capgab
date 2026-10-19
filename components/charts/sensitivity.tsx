"use client";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export default function Sensitivity({
  points,
}: {
  points: { size: number; displayed: number; exit: number | null }[];
}) {
  return (
    <div
      className="chart-wrap"
      role="img"
      aria-label="Position-size sensitivity: displayed value and independently quoted estimated proceeds"
    >
      <ResponsiveContainer width="100%" height={245}>
        <LineChart
          data={points}
          margin={{ top: 15, right: 15, bottom: 10, left: 0 }}
        >
          <CartesianGrid
            stroke="#222a35"
            strokeDasharray="3 5"
            vertical={false}
          />
          <XAxis
            dataKey="size"
            tickFormatter={(v) => `$${v}`}
            stroke="#8d98a8"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            tickFormatter={(v) => `$${v}`}
            stroke="#8d98a8"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: "#151b24",
              border: "1px solid #303a47",
              borderRadius: 6,
            }}
            labelFormatter={(v) =>
              `$${v} position · estimate, not guaranteed execution`
            }
            formatter={(v) => [`$${Number(v).toFixed(2)}`]}
          />
          <Legend />
          <Line
            type="linear"
            dataKey="displayed"
            name="Displayed value"
            stroke="#657181"
            strokeDasharray="4 4"
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="exit"
            name="Quoted proceeds"
            stroke="#b5ff39"
            strokeWidth={2}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
