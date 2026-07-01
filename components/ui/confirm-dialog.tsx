import * as React from "react"
import { AlertTriangle, type LucideIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** destructive shows a red icon + destructive confirm button */
  variant?: "destructive" | "default"
  icon?: LucideIcon
  loading?: boolean
  onConfirm: () => void | Promise<void>
}

/**
 * Standardized confirmation dialog. Replaces the many ad-hoc delete/confirm
 * dialogs so every confirm flow looks and behaves the same.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "default",
  icon: Icon = AlertTriangle,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const destructive = variant === "destructive"
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!loading}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                destructive ? "bg-destructive/12 text-destructive" : "bg-brand/12 text-brand"
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1 pt-0.5">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="leading-relaxed">{description}</DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Spinner className="text-current" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmDialog }
