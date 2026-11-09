import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';

export interface CheckboxProps {
  label?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  indeterminate?: boolean;
}

const boxSizes: Record<'sm' | 'md' | 'lg', number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

const labelSizes: Record<'sm' | 'md' | 'lg', number> = {
  sm: 14,
  md: 15,
  lg: 17,
};

export const Checkbox = ({
  label,
  value,
  onChange,
  disabled = false,
  size = 'md',
  indeterminate = false,
}: CheckboxProps) => {
  const handlePress = () => {
    if (!disabled) {
      onChange(!value);
    }
  };

  const boxStyle: StyleProp<ViewStyle> = [
    styles.box,
    { width: boxSizes[size], height: boxSizes[size] },
    value
      ? styles.boxChecked
      : indeterminate
        ? styles.boxIndeterminate
        : styles.boxUnchecked,
    disabled ? styles.disabled : null,
  ];

  const labelStyle: StyleProp<TextStyle> = [styles.label, { fontSize: labelSizes[size] }, disabled ? styles.disabled : null];

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled}
      style={styles.row}
      activeOpacity={0.7}
    >
      <View style={boxStyle}>
        {value ? (
          <Text style={styles.check}>✓</Text>
        ) : indeterminate ? (
          <View style={styles.dash} />
        ) : null}
      </View>
      {label ? <Text style={labelStyle}>{label}</Text> : null}
    </TouchableOpacity>
  );
};

export interface CheckboxGroupProps {
  label?: string;
  options: Array<{ label: string; value: string; disabled?: boolean }>;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  columns?: 1 | 2 | 3;
}

export const CheckboxGroup = ({
  label,
  options,
  value,
  onChange,
  disabled = false,
  columns = 1,
}: CheckboxGroupProps) => {
  const handleChange = (optionValue: string) => {
    if (disabled) return;
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  return (
    <View>
      {label ? <Text style={styles.groupLabel}>{label}</Text> : null}
      <View style={[styles.group, columns === 1 ? styles.groupColumn : styles.groupRow]}>
        {options.map((opt) => (
          <Checkbox
            key={opt.value}
            label={opt.label}
            value={value.includes(opt.value)}
            onChange={() => handleChange(opt.value)}
            disabled={disabled || opt.disabled}
            size="md"
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  box: {
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  boxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  boxIndeterminate: {
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
    borderColor: '#3b82f6',
  },
  boxUnchecked: {
    backgroundColor: 'transparent',
    borderColor: '#2a2a3e',
  },
  check: {
    color: '#ffffff',
    fontSize: 12,
    lineHeight: 14,
  },
  dash: {
    width: '60%',
    height: 2,
    backgroundColor: '#ffffff',
  },
  label: {
    fontWeight: '500',
    color: '#e8e8f0',
  },
  disabled: {
    opacity: 0.5,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e8e8f0',
    marginBottom: 8,
  },
  group: {
    gap: 8,
  },
  groupColumn: {
    flexDirection: 'column',
  },
  groupRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
});
