"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/cn"

const SelectContext = React.createContext<{
  value?: string
  onValueChange?: (value: string) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
} | null>(null)

const Select = ({
  children,
  onValueChange,
  defaultValue,
  containerClassName,
}: {
  children: React.ReactNode
  onValueChange?: (value: string) => void
  defaultValue?: string
  containerClassName?: string
}) => {
  const [value, setValue] = React.useState(defaultValue)
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    if (defaultValue !== undefined) {
      setValue(defaultValue)
    }
  }, [defaultValue])

  const handleValueChange = React.useCallback((newValue: string) => {
    setValue(newValue)
    onValueChange?.(newValue)
    setIsOpen(false)
  }, [onValueChange])

  const containerRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, isOpen, setIsOpen }}>
      <div ref={containerRef} className={cn("relative w-full", containerClassName)}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  if (!context) return null

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => context.setIsOpen(!context.isOpen)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform duration-200", context.isOpen && "rotate-180")} />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = ({ placeholder, value: propValue }: any) => {
  const context = React.useContext(SelectContext)
  if (!context) return null
  
  return <span className="block truncate">{propValue || placeholder}</span>
}

const SelectContent = ({ children, className }: any) => {
  const context = React.useContext(SelectContext)
  if (!context || !context.isOpen) return null

  return (
    <div className={cn(
      "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in zoom-in-95",
      className
    )}>
      <div className="p-1">
        {children}
      </div>
    </div>
  )
}

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, children, value, ...props }, ref) => {
  const context = React.useContext(SelectContext)
  if (!context) return null

  const isSelected = context.value === value

  return (
    <div
      ref={ref}
      onClick={() => context.onValueChange?.(value)}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        !isSelected &&
          "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        isSelected &&
          "bg-violet-100 text-violet-950 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-50 dark:hover:bg-violet-500/30",
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && (
          <Check className="h-4 w-4 text-violet-600 dark:text-violet-300" strokeWidth={2.5} />
        )}
      </span>
      {children}
    </div>
  )
})
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
