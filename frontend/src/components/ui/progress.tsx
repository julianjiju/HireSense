import * as React from "react"
import { cn } from "../../lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  indicatorColor?: string
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, indicatorColor, ...props }, ref) => {
    const getAutoColor = (v: number) => {
      if (v >= 80) return "bg-gradient-to-r from-emerald-500 to-green-400"
      if (v >= 50) return "bg-gradient-to-r from-amber-500 to-yellow-400"
      return "bg-gradient-to-r from-red-500 to-rose-400"
    }

    const color = indicatorColor || getAutoColor(value || 0)

    return (
      <div
        ref={ref}
        className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-white/5", className)}
        {...props}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-out", color)}
          style={{ width: `${Math.min(value || 0, 100)}%` }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
