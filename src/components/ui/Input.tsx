import React from 'react';
import { TextInput, TextInputProps, View, Text, StyleSheet } from 'react-native';

export interface InputProps extends Omit<TextInputProps, 'onChangeText' | 'value' | 'onFocus' | 'onBlur'> {
  label?: string;
  error?: string;
  helperText?: string;
  value: string;
  onChangeText: (text: string) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: any;
}

export const Input = ({
  label,
  error,
  helperText,
  value,
  onChangeText,
  leftIcon,
  rightIcon,
  style,
  ...props
}: InputProps) => {
  const hasError = !!error;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      <View style={styles.inputWrapper}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.input,
            hasError ? styles.inputError : undefined,
            leftIcon ? styles.inputWithLeftIcon : undefined,
            rightIcon ? styles.inputWithRightIcon : undefined,
          ]}
          placeholderTextColor="#8888a0"
          {...props}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {hasError && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      {!hasError && helperText && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
};

export interface TextAreaProps extends Omit<TextInputProps, 'onChangeText' | 'value'> {
  label?: string;
  error?: string;
  helperText?: string;
  value: string;
  onChangeText: (text: string) => void;
  rows?: number;
  style?: any;
}

export const TextArea = ({
  label,
  error,
  helperText,
  value,
  onChangeText,
  rows = 4,
  style,
  ...props
}: TextAreaProps) => {
  const hasError = !!error;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={styles.label}>{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline
        numberOfLines={rows}
        style={[
          styles.textarea,
          hasError ? styles.inputError : undefined,
        ]}
        placeholderTextColor="#8888a0"
        {...props}
      />
      {hasError && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      {!hasError && helperText && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: '#aaaaaa',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 8,
  },
  iconLeft: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  iconRight: {
    position: 'absolute',
    right: 12,
    zIndex: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e8e8f0',
    fontSize: 15,
  },
  inputWithLeftIcon: {
    paddingLeft: 40,
  },
  inputWithRightIcon: {
    paddingRight: 40,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textarea: {
    minHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e8e8f0',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
  },
  helperText: {
    fontSize: 11,
    color: '#8888a0',
  },
});