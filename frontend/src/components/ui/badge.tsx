import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
        {
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200": variant === "default",
          "border-transparent bg-gray-100 text-gray-800": variant === "secondary",
          "border-transparent bg-red-100 text-red-800 hover:bg-red-200": variant === "destructive",
          "border-transparent bg-green-100 text-green-800": variant === "success",
          "text-foreground": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
