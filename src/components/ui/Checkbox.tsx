import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface CheckboxProps {
  label?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  indeterminate?: boolean;
}

const sizeStyles = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

const labelSizeStyles = {
  sm: 'text-sm',
  md: 'text-md',
  lg: 'text-lg',
};

export const Checkbox = ({
  label,
  value,
  onChange,
  disabled = false,
  className = '',
  labelClassName = '',
  size = 'md',
  indeterminate = false,
}: CheckboxProps) => {
  const handlePress = () => {
    if (!disabled) {
      onChange(!value);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      className={`flex-row items-center gap-2 ${className}`}
      activeOpacity={0.7}
    >
      <View
        className={`
          ${sizeStyles[size]}
          rounded border-2
          flex-shrink-0
          transition-colors duration-150
          ${value ? 'bg-accent border-accent' : indeterminate ? 'bg-accent/50 border-accent' : 'border-border'}
          ${disabled ? 'opacity-50' : ''}
        `}
        style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {value && (
          <Text className="text-white text-xs" style={{ lineHeight: 1 }}>✓</Text>
        )}
        {indeterminate && !value && (
          <View className="w-full h-0.5 bg-white" />
        )}
      </View>
      {label && (
        <Text
          className={`font-medium text-text ${labelSizeStyles[size]} ${labelClassName}`}
          disabled={disabled}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

export interface CheckboxGroupProps {
  label?: string;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
  columns?: 1 | 2 | 3;
}

export const CheckboxGroup = ({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = '',
  columns = 1,
}: CheckboxGroupProps) => {
  const handleChange = (optionValue: string) => {
    if (disabled) return;
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const columnStyles = {
    1: 'flex-col gap-2',
    2: 'flex-row flex-wrap gap-4',
    3: 'flex-row flex-wrap gap-4',
  };

  return (
    <View className={className}>
      {label && <Text className="text-sm font-medium text-text mb-2">{label}</Text>}
      <View className={columnStyles[columns]}>
        {options.map((opt) => (
          <Checkbox
            key={opt.value}
            label={opt.label}
            value={value.includes(opt.value)}
            onChange={(checked) => handleChange(opt.value)}
            disabled={disabled || opt.disabled}
            size="md"
          />
        ))}
      </View>
    </View>
  );
};