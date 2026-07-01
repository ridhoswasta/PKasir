import * as React from "react"
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "default" | "success" | "warning" | "destructive" | "info" | "brand"

const toneStyles: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
  brand: "bg-brand/12 text-brand",
}

interface StatCardProps extends React.ComponentProps<"div"> {
  label: string
  value: React.ReactNode
  sub?: string
  icon?: LucideIcon
  tone?: Tone
  /** Positive/negative percent change, e.g. 12.5 or -3.2 */
  trend?: number
}

/** Consistent KPI / summary metric card used across Dashboard, Reports, Money Flow. */
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "default",
  trend,
  className,
  ...props
}: StatCardProps) {
  const hasTrend = typeof trend === "number" && isFinite(trend)
  const up = (trend ?? 0) >= 0
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex flex-col justify-between gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10 hover-lift",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", toneStyles[tone])}>
            <Icon className="size-4" strokeWidth={1.9} aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight text-foreground truncate">{value}</p>
        <div className="flex items-center gap-2">
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          {hasTrend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-semibold",
                up ? "text-success" : "text-destructive"
              )}
            >
              {up ? (
                <TrendingUp className="size-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3" aria-hidden="true" />
              )}
              {Math.abs(trend!).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export { StatCard }
