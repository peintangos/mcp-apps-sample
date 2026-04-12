import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useColors } from "../main.js";

const PALETTE = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f97316", // orange
  "#ec4899", // pink
];

type Language = { name: string; percentage: number };

export function LanguageDonut({ languages }: { languages: Language[] }) {
  const colors = useColors();

  if (languages.length === 0) {
    return (
      <div style={{ padding: "1rem", color: colors.textMuted, textAlign: "center" }}>
        No language data
      </div>
    );
  }

  const top = languages.slice(0, 6);
  const rest = languages.slice(6);
  const data =
    rest.length > 0
      ? [
          ...top,
          {
            name: "Other",
            percentage: rest.reduce((sum, l) => sum + l.percentage, 0),
          },
        ]
      : top;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
          <Pie
            data={data}
            dataKey="percentage"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_entry, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `${Number(value).toFixed(1)}%`}
            contentStyle={{
              background: colors.tooltipBg,
              border: `1px solid ${colors.tooltipBorder}`,
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              color: colors.text,
            }}
            itemStyle={{ color: colors.text }}
            labelStyle={{ color: colors.textMuted }}
          />
          <Legend
            verticalAlign="bottom"
            height={40}
            iconType="circle"
            wrapperStyle={{ fontSize: "0.75rem", color: colors.text }}
          />
        </PieChart>
      </ResponsiveContainer>
  );
}
