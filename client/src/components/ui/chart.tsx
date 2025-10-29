"use client"

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Re-export all recharts components
export const Area = RechartsPrimitive.Area
export const AreaChart = RechartsPrimitive.AreaChart
export const Bar = RechartsPrimitive.Bar
export const BarChart = RechartsPrimitive.BarChart
export const CartesianGrid = RechartsPrimitive.CartesianGrid
export const Cell = RechartsPrimitive.Cell
export const ComposedChart = RechartsPrimitive.ComposedChart
export const Legend = RechartsPrimitive.Legend
export const Line = RechartsPrimitive.Line
export const LineChart = RechartsPrimitive.LineChart
export const Pie = RechartsPrimitive.Pie
export const PieChart = RechartsPrimitive.PieChart
export const ResponsiveContainer = RechartsPrimitive.ResponsiveContainer
export const Scatter = RechartsPrimitive.Scatter
export const ScatterChart = RechartsPrimitive.ScatterChart
export const Tooltip = RechartsPrimitive.Tooltip
export const XAxis = RechartsPrimitive.XAxis
export const YAxis = RechartsPrimitive.YAxis

// Chart container component
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <div
      data-chart={chartId}
      ref={ref}
      className={cn(
        "flex w-full flex-col items-center justify-center [&_.recharts-cartesian-axis-tick-value]:fill-muted-foreground [&_.recharts-cartesian-grid-horizontal]:stroke-muted [&_.recharts-cartesian-grid-vertical]:stroke-muted [&_.recharts-curve]:stroke-[var(--color-chart-1)] [&_.recharts-dot]:stroke-[var(--color-chart-1)] [&_.recharts-layer]:outline-none [&_.recharts-polar-grid]:stroke-muted [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle]:stroke-muted [&_.recharts-reference-line]:stroke-muted [&_.recharts-sector]:outline-none [&_.recharts-sector]:stroke-none [&_.recharts-surface]:outline-none",
        className
      )}
      {...props}
    >
      <ChartStyle id={chartId} config={config} />
      {children}
    </div>
  )
})
ChartContainer.displayName = "Chart"

// Chart style component
const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([_, config]) => config.theme
  )

  if (!colorConfig.length) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
:root {
  ${colorConfig
    .map(([key, itemConfig]) => {
      const color = itemConfig.theme?.light || itemConfig.color
      return color ? `--color-${key}: ${color};` : null
    })
    .filter(Boolean)
    .join("\n")}
}

.dark {
  ${colorConfig
    .map(([key, itemConfig]) => {
      const color = itemConfig.theme?.dark || itemConfig.color
      return color ? `--color-${key}: ${color};` : null
    })
    .filter(Boolean)
    .join("\n")}
}

[data-chart="${id}"] {
  ${Object.entries(config)
    .map(([key, itemConfig]) => {
      if (key === "chart") return null
      const color = itemConfig.color || `var(--color-${key})`
      return `--color-${key}: ${color};`
    })
    .filter(Boolean)
    .join("\n")}
}`,
      }}
    />
  )
}

// Chart tooltip component
const ChartTooltip = RechartsPrimitive.Tooltip

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean
      hideIndicator?: boolean
      indicator?: "line" | "dot" | "dashed"
      nameKey?: string
      labelKey?: string
    }
>(
  (
    {
      active,
      payload,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) {
        return null
      }

      const [item] = payload
      const key = `${labelKey || item.dataKey || item.name || "value"}`
      const value =
        typeof label === "string" ? label : labelFormatter?.(label, payload)

      return (
        <div className={cn("font-medium", labelClassName)}>
          {typeof formatter === "function" && item
            ? formatter(value, key, item, 0, payload)
            : value}
        </div>
      )
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      labelKey,
      formatter,
    ])

    if (!active || !payload?.length) {
      return null
    }

    const [item] = payload

    return (
      <div
        ref={ref}
        className={cn(
          "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
          className
        )}
      >
        {tooltipLabel}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || "value"}`
            const indicatorColor = color || item.payload?.fill || item.color

            return (
              <div
                key={item.dataKey}
                className={cn(
                  "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                  indicator === "dot" && "items-center"
                )}
              >
                {formatter && item ? (
                  formatter(item.value, key, item, index, payload)
                ) : (
                  <>
                    {!hideIndicator && (
                      <div
                        className={cn(
                          "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                          {
                            "h-2.5 w-2.5": indicator === "dot",
                            "w-1": indicator === "line",
                            "w-0 border-[1.5px] border-dashed bg-transparent":
                              indicator === "dashed",
                          }
                        )}
                        style={
                          {
                            "--color-bg": indicatorColor,
                            "--color-border": indicatorColor,
                          } as React.CSSProperties
                        }
                      />
                    )}
                    <div
                      className={cn(
                        "flex flex-1 justify-between leading-none",
                        hideIndicator && "items-center"
                      )}
                    >
                      <div className="grid gap-[2px]">
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {key}
                        </div>
                        <div className="font-mono text-[10px] font-medium tabular-nums text-foreground">
                          {item.value}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }
)
ChartTooltipContent.displayName = "ChartTooltipContent"

// Chart legend component
const ChartLegend = RechartsPrimitive.Legend

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(
  ({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
    if (!payload?.length) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center gap-4",
          verticalAlign === "top" ? "pb-3" : "pt-3",
          className
        )}
      >
        {payload.map((item) => {
          const key = `${nameKey || item.dataKey || "value"}`

          return (
            <div
              key={item.value}
              className={cn(
                "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
              )}
            >
              {!hideIcon && (
                <div
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: item.color,
                  }}
                />
              )}
              <div className="grid gap-[2px]">
                <div className="font-mono text-[10px] text-muted-foreground">
                  {key}
                </div>
                <div className="font-mono text-[10px] font-medium tabular-nums text-foreground">
                  {item.value}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
)
ChartLegendContent.displayName = "ChartLegendContent"

// Chart config type
type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | {
        color?: string
        theme?: never
      }
    | {
        color?: never
        theme: {
          light?: string
          dark?: string
        }
      }
  )
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
}
