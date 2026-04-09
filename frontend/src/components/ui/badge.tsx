import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "neon"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200",
        {
          "border-blue-500/30 bg-blue-500/15 text-blue-300": variant === "default",
          "border-white/10 bg-white/5 text-slate-400": variant === "secondary",
          "border-red-500/30 bg-red-500/15 text-red-300": variant === "destructive",
          "border-green-500/30 bg-green-500/15 text-green-300": variant === "success",
          "border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-neon-cyan": variant === "neon",
          "border-white/10 text-slate-300": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
