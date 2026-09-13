import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from '../../lib/utils';

// This app's dark mode is the [data-theme='dark'] attribute set by renderer/theme.ts, not a
// `.dark` class — the canonical shadcn chart template assumes the latter, so this selector is
// adapted accordingly. Without this, dark-mode chart colors would silently never apply.
const THEMES = { light: '', dark: '[data-theme="dark"]' } as const;

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

interface ChartContextProps {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error('Chart components must be used within a <ChartContainer />');
  }
  return context;
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-layer]:outline-none [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-border [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = 'ChartContainer';

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, cfg]) => cfg.theme || cfg.color);
  if (colorConfig.length === 0) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, selector]) => `
${selector} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] ?? itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<'div'> & {
      labelFormatter?: (value: unknown, payload: unknown[]) => React.ReactNode;
    }
>(({ active, payload, className, label, labelFormatter }, ref) => {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        'grid min-w-32 items-start gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs neu-raised-sm',
        className,
      )}
    >
      <div className="font-medium text-heading">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      <div className="grid gap-1.5">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? 'value');
          const itemConfig = config[key];
          return (
            <div key={key} className="flex w-full items-center gap-2">
              <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
              <div className="flex flex-1 justify-between gap-2 leading-none">
                <span className="text-muted">{itemConfig?.label ?? item.name}</span>
                <span className="font-mono font-medium text-heading">
                  {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = 'ChartTooltipContent';
