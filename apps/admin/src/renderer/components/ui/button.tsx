import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-body text-base font-semibold text-heading cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 transition-shadow',
  {
    variants: {
      variant: {
        default: 'bg-surface neu-raised active:neu-inset',
        ghost: 'bg-transparent hover:bg-sidebar-hover',
        outline: 'bg-surface neu-inset-sm',
      },
      size: {
        default: '',
        sm: 'px-3 py-2 text-sm',
        icon: 'p-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
