'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DataPoint {
  type: string
  count: number
}

const COLORS = [
  'hsl(220 90% 55%)',
  'hsl(160 75% 45%)',
  'hsl(280 75% 55%)',
  'hsl(35 95% 55%)',
  'hsl(0 80% 60%)',
  'hsl(190 85% 50%)',
  'hsl(330 75% 55%)',
  'hsl(120 60% 45%)',
]

export function TypeChart({ data }: { data: DataPoint[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">По типам</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="type"
              innerRadius={50}
              outerRadius={85}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value, name) => {
                const v = Number(value)
                return [`${v} (${total > 0 ? Math.round((v / total) * 100) : 0}%)`, String(name)]
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
