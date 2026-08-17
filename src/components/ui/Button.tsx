import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  children: React.ReactNode
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  style = {},
  children,
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }

  const widthClass = fullWidth ? 'w-full' : ''

  // Inline styles referencing CSS variables for robust dynamic theme reactivity
  let variantStyle: React.CSSProperties = {}

  if (variant === 'primary') {
    variantStyle = {
      backgroundColor: 'var(--color-primary)',
      color: '#FFFFFF',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    }
  } else if (variant === 'secondary') {
    variantStyle = {
      backgroundColor: 'var(--color-secondary)',
      color: '#FFFFFF',
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    }
  } else if (variant === 'ghost') {
    variantStyle = {
      backgroundColor: 'transparent',
      borderColor: 'var(--color-border)',
      borderWidth: '1px',
      borderStyle: 'solid',
      color: 'var(--color-text)',
    }
  }

  return (
    <button
      type="button"
      className={`${baseClasses} ${sizeClasses[size]} ${widthClass} ${className}`}
      style={{ ...variantStyle, ...style }}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
