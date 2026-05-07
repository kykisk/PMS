import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-[#5E6AD2] text-white hover:bg-[#6872D9] shadow-[0_0_0_1px_rgba(94,106,210,0.5),0_2px_8px_rgba(94,106,210,0.25)] hover:shadow-[0_0_0_1px_rgba(94,106,210,0.6),0_4px_12px_rgba(94,106,210,0.3)]',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-[#5E6AD2]/30',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  disabledReason?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disabled, disabledReason, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const [tip, setTip] = React.useState<{ x: number; y: number } | null>(null)

    if (disabled && disabledReason) {
      return (
        <span
          className="relative inline-flex"
          onMouseEnter={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setTip({ x: rect.left + rect.width / 2, y: rect.bottom + 4 })
          }}
          onMouseLeave={() => setTip(null)}
        >
          <Comp
            className={cn(buttonVariants({ variant, size, className }), 'pointer-events-none opacity-50')}
            ref={ref}
            disabled
            {...props}
          />
          {tip && (
            <span
              className="fixed z-[9999] px-2 py-1 bg-gray-900 text-white text-[10px] rounded shadow-lg whitespace-nowrap pointer-events-none"
              style={{ left: tip.x, top: tip.y, transform: 'translateX(-50%)' }}
            >
              {disabledReason}
            </span>
          )}
        </span>
      )
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }), disabled && 'pointer-events-none')}
        ref={ref}
        disabled={disabled}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
