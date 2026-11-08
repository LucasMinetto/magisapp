import React from 'react';
import { View, Text, ViewProps, TextProps } from 'react-native';

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles = {
  default: 'bg-bgElevated',
  elevated: 'bg-bgElevated shadow-lg',
  outlined: 'bg-transparent border border-border',
};

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  style,
  ...props
}: CardProps) => {
  return (
    <View
      className={`
        rounded-xl
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
      style={style}
      {...props}
    >
      {children}
    </View>
  );
};

Card.displayName = 'Card';

interface CardHeaderProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader = ({ children, className = '', ...props }: CardHeaderProps) => (
  <View className={`mb-3 ${className}`} {...props}>{children}</View>
);

interface CardTitleProps extends TextProps {
  children: React.ReactNode;
  className?: string;
}

export const CardTitle = ({ children, className = '', ...props }: CardTitleProps) => (
  <Text className={`text-lg font-semibold text-text ${className}`} {...props}>{children}</Text>
);

interface CardDescriptionProps extends TextProps {
  children: React.ReactNode;
  className?: string;
}

export const CardDescription = ({ children, className = '', ...props }: CardDescriptionProps) => (
  <Text className={`text-sm text-textMuted mt-1 ${className}`} {...props}>{children}</Text>
);

export const CardContent = ({ children, className = '', ...props }: ViewProps) => (
  <View className={className} {...props}>{children}</View>
);

interface CardFooterProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter = ({ children, className = '', ...props }: CardFooterProps) => (
  <View className={`mt-4 flex-row items-center justify-end gap-2 ${className}`} {...props}>{children}</View>
);