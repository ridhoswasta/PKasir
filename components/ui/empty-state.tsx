import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  /** Render compactly (e.g. inside a table cell area) */
  compact?: boolean
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center text-center anim-scale",
        compact ? "py-10 px-4 gap-2" : "py-16 px-6 gap-3",
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl bg-muted text-muted-foreground",
            compact ? "size-11 mb-1" : "size-14 mb-1"
          )}
        >
          <Icon className={compact ? "size-5" : "size-6"} strokeWidth={1.8} aria-hidden="true" />
        </div>
      )}
      <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
        {title}
      </p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
