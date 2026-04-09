import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "neon"
  size?: "default" | "sm" | "lg"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
          {
            "bg-blue-600 text-white hover:bg-blue-500 hover:shadow-neon-blue": variant === "default",
            "border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-slate-200": variant === "outline",
            "hover:bg-white/5 text-slate-400 hover:text-slate-200": variant === "ghost",
            "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-neon-cyan hover:scale-[1.02]": variant === "neon",
            "h-10 px-4 py-2": size === "default",
            "h-8 rounded-lg px-3 text-xs": size === "sm",
            "h-12 rounded-xl px-8 text-base font-semibold": size === "lg",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
