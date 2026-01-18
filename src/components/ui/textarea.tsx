import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // Base styles
        "flex w-full rounded-md border border-input bg-transparent px-3 py-3 shadow-sm",
        // Touch-friendly sizing: minimum height for comfortable touch on mobile
        "min-h-[80px] md:min-h-[60px]",
        // Typography: larger on mobile for readability
        "text-base md:text-sm",
        // Placeholder and focus
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        // Mobile-friendly resize behavior
        "resize-y",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
