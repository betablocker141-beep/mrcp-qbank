interface DataPoint {
  label: string;
  value: number; // 0-100
  attempted: number;
}

interface Props {
  data: DataPoint[];
  size?: number;
}

const COLORS = {
  fill: 'rgba(99,102,241,0.18)',
  stroke: 'rgb(99,102,241)',
  grid: '#e5e7eb',
  dot: 'rgb(99,102,241)',
  label: '#374151',
  tick: '#9ca3af',
  excellent: 'rgba(16,185,129,0.18)',
};

export default function RadarChart({ data, size = 380 }: Props) {
  if (!data || data.length < 3) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Attempt at least 3 systems to see the radar chart
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * 0.62;
  const labelRadius = radius + 38;
  const levels = 4;
  const n = data.length;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const polar = (r: number, i: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  // Grid polygons
  const gridLevels = Array.from({ length: levels }, (_, i) => {
    const r = (radius * (i + 1)) / levels;
    return Array.from({ length: n }, (_, j) => polar(r, j));
  });

  // Data polygon
  const dataPoints = data.map((d, i) => polar((radius * d.value) / 100, i));

  const toPath = (points: { x: number; y: number }[]) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

  // Color per value
  const dotColor = (v: number) => {
    if (v >= 75) return '#10b981';
    if (v >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const LABEL_MAX_CHARS = 12;
  const truncate = (s: string) => s.length > LABEL_MAX_CHARS ? s.slice(0, LABEL_MAX_CHARS - 1) + '…' : s;

  return (
    <div className="flex flex-col items-center gap-4">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* Grid circles / polygons */}
        {gridLevels.map((pts, li) => (
          <polygon
            key={li}
            points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={COLORS.grid}
            strokeWidth="1"
          />
        ))}

        {/* Tick labels on y-axis spoke */}
        {Array.from({ length: levels }, (_, i) => {
          const r = (radius * (i + 1)) / levels;
          const p = polar(r, 0);
          return (
            <text
              key={i}
              x={p.x + 4}
              y={p.y}
              fontSize="9"
              fill={COLORS.tick}
              dominantBaseline="middle"
            >
              {Math.round(((i + 1) / levels) * 100)}%
            </text>
          );
        })}

        {/* Spokes */}
        {data.map((_, i) => {
          const outer = polar(radius, i);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={outer.x.toFixed(1)}
              y2={outer.y.toFixed(1)}
              stroke={COLORS.grid}
              strokeWidth="1"
            />
          );
        })}

        {/* Excellent zone (75%) */}
        <polygon
          points={Array.from({ length: n }, (_, i) => {
            const p = polar(radius * 0.75, i);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          }).join(' ')}
          fill={COLORS.excellent}
          stroke="none"
        />

        {/* Data polygon */}
        <path
          d={toPath(dataPoints)}
          fill={COLORS.fill}
          stroke={COLORS.stroke}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={6}
              fill={dotColor(data[i].value)}
              stroke="white"
              strokeWidth="2"
            />
            {/* Value tooltip bubble */}
            <title>{`${data[i].label}: ${data[i].value.toFixed(0)}% (${data[i].attempted} attempted)`}</title>
          </g>
        ))}

        {/* Labels */}
        {data.map((d, i) => {
          const p = polar(labelRadius, i);
          const textAnchor =
            Math.abs(p.x - cx) < 10 ? 'middle' : p.x < cx ? 'end' : 'start';
          return (
            <g key={i}>
              <text
                x={p.x.toFixed(1)}
                y={(p.y - 7).toFixed(1)}
                fontSize="11"
                fontWeight="600"
                fill={COLORS.label}
                textAnchor={textAnchor}
                dominantBaseline="middle"
              >
                {truncate(d.label)}
              </text>
              <text
                x={p.x.toFixed(1)}
                y={(p.y + 7).toFixed(1)}
                fontSize="10"
                fill={dotColor(d.value)}
                textAnchor={textAnchor}
                dominantBaseline="middle"
                fontWeight="700"
              >
                {d.value.toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={3} fill={COLORS.stroke} />
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="text-gray-500">≥75% Excellent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="text-gray-500">50–74% Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <span className="text-gray-500">&lt;50% Needs work</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-200 border border-emerald-400" />
          <span className="text-gray-500">75% target zone</span>
        </div>
      </div>
    </div>
  );
}
