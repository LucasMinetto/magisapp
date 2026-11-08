import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal } from 'react-native';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  style?: any;
}

export const Select = ({
  label,
  error,
  helperText,
  value,
  onChange,
  options,
  placeholder = 'Selecionar...',
  searchable = false,
  style,
}: SelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<React.ComponentRef<typeof View> | null>(null);
  const hasError = !!error;

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleOutsidePress = (event: any) => {
      if (dropdownRef.current && event.nativeEvent.target !== dropdownRef.current) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('touchstart', handleOutsidePress);
    }
    return () => document.removeEventListener('touchstart', handleOutsidePress);
  }, [isOpen]);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        onPress={() => !hasError && setIsOpen(!isOpen)}
        style={[
          styles.select,
          hasError && styles.selectError,
          style,
        ]}
        disabled={hasError}
      >
        <Text style={[
          styles.selectText,
          value ? {} : styles.selectPlaceholder,
        ]}>
          {value ? selectedOption?.label : placeholder}
        </Text>
        <Text style={styles.selectArrow}>▼</Text>
      </TouchableOpacity>

      {hasError && <Text style={styles.errorText}>{error}</Text>}
      {!hasError && helperText && <Text style={styles.helperText}>{helperText}</Text>}

      {isOpen && (
        <Modal
          visible={isOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setIsOpen(false)}
        >
          <View style={StyleSheet.absoluteFill} onTouchStart={() => setIsOpen(false)} />
          <View style={styles.dropdownContainer}>
            {searchable && (
              <TextInput
                placeholder="Buscar..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={styles.searchInput}
                autoFocus
              />
            )}
            <View style={styles.dropdownContent} ref={dropdownRef}>
              {filteredOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  disabled={opt.disabled}
                  style={styles.option}
                >
                  <Text style={[
                    styles.optionText,
                    opt.value === value && styles.optionTextSelected,
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Modal>
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
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 48,
  },
  selectError: {
    borderColor: '#ef4444',
  },
  selectText: {
    color: '#e8e8f0',
    fontSize: 15,
    flex: 1,
  },
  selectPlaceholder: {
    color: '#8888a0',
  },
  selectArrow: {
    color: '#8888a0',
    fontSize: 16,
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
  },
  helperText: {
    fontSize: 11,
    color: '#8888a0',
  },
  dropdownContainer: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 8,
    maxHeight: 300,
  },
  searchInput: {
    backgroundColor: '#0f0f1a',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e8e8f0',
    fontSize: 15,
    marginBottom: 8,
  },
  dropdownContent: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
    borderRadius: 8,
    overflow: 'hidden',
    maxHeight: 300,
  },
  option: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  optionText: {
    color: '#e8e8f0',
    fontSize: 15,
  },
  optionTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
});