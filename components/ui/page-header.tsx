import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps extends React.ComponentProps<"div"> {
  title: string
  description?: string
  icon?: LucideIcon
  /** Right-aligned actions (buttons, filters) */
  actions?: React.ReactNode
}

/**
 * Consistent module header. Use at the top of every module's content area so
 * title typography, spacing and action placement match across pages.
 */
function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Icon className="size-5" strokeWidth={1.9} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground truncate">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export { PageHeader }
