import React from 'react';
import { View, Text, StyleSheet, ViewProps, TextProps, ViewStyle } from 'react-native';

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantStyles: Record<NonNullable<CardProps['variant']>, ViewStyle> = {
  default: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a3e' },
  elevated: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  outlined: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2a2a3e' },
};

const paddingStyles: Record<NonNullable<CardProps['padding']>, ViewStyle> = {
  none: {},
  sm: { padding: 12 },
  md: { padding: 16 },
  lg: { padding: 24 },
};

export const Card = ({
  children,
  variant = 'default',
  padding = 'md',
  style,
  ...props
}: CardProps) => {
  return (
    <View
      style={[styles.card, variantStyles[variant], paddingStyles[padding], style]}
      {...props}
    >
      {children}
    </View>
  );
};

Card.displayName = 'Card';

interface CardHeaderProps extends ViewProps {
  children: React.ReactNode;
}

export const CardHeader = ({ children, style, ...props }: CardHeaderProps) => (
  <View style={[styles.header, style]} {...props}>{children}</View>
);

interface CardTitleProps extends TextProps {
  children: React.ReactNode;
}

export const CardTitle = ({ children, style, ...props }: CardTitleProps) => (
  <Text style={[styles.title, style]} {...props}>{children}</Text>
);

interface CardDescriptionProps extends TextProps {
  children: React.ReactNode;
}

export const CardDescription = ({ children, style, ...props }: CardDescriptionProps) => (
  <Text style={[styles.description, style]} {...props}>{children}</Text>
);

export const CardContent = ({ children, style, ...props }: ViewProps) => (
  <View style={style} {...props}>{children}</View>
);

interface CardFooterProps extends ViewProps {
  children: React.ReactNode;
}

export const CardFooter = ({ children, style, ...props }: CardFooterProps) => (
  <View style={[styles.footer, style]} {...props}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e8e8f0',
  },
  description: {
    fontSize: 14,
    color: '#8888a0',
    marginTop: 4,
  },
  footer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
