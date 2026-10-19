"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export default function History({
  observations,
}: {
  observations: { observed_at: string; deviation: string }[];
}) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart
          data={[...observations].reverse().map((o) => ({
            time: new Date(o.observed_at).toLocaleTimeString(),
            deviation: Number(o.deviation),
          }))}
        >
          <CartesianGrid stroke="#232a34" />
          <XAxis dataKey="time" stroke="#8d98a8" fontSize={10} />
          <YAxis stroke="#8d98a8" fontSize={10} unit="%" />
          <Tooltip
            contentStyle={{
              background: "#10151d",
              border: "1px solid #303a47",
            }}
          />
          <Line
            dataKey="deviation"
            stroke="#b5ff39"
            dot={false}
            name="Comparable deviation (%)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
