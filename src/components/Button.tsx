import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-body';
    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow-md',
      secondary: 'bg-surface border border-border text-text-primary hover:bg-background',
      ghost: 'text-text-secondary hover:text-text-primary hover:bg-background',
      danger: 'bg-danger text-white hover:bg-red-700 shadow-sm',
    };
    const sizes: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-sm',
      lg: 'px-7 py-3 text-base',
    };

    return (
      <motion.button
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: variant === 'primary' ? -1 : 0 }}
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...(props as any)}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : leftIcon ? leftIcon : null}
        {children}
        {rightIcon && !loading ? rightIcon : null}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
