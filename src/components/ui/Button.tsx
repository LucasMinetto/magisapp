import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'onPress'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
  onPress?: () => void;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white',
  secondary: 'bg-bgElevated text-text border border-border',
  ghost: 'bg-transparent text-text',
  danger: 'bg-error text-white',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-md',
  lg: 'px-6 py-3 text-lg',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  onPress,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      className={`
        flex-row items-center justify-center rounded-lg
        transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={style}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : '#3b82f6'} size="small" />
      ) : (
        <>
          {leftIcon && <span className="mr-2">{leftIcon}</span>}
          <Text className="font-medium">{children}</Text>
          {rightIcon && <span className="ml-2">{rightIcon}</span>}
        </>
      )}
    </TouchableOpacity>
  );
};

Button.displayName = 'Button';