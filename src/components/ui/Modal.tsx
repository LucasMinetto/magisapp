import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal as RNModal } from 'react-native';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  hideCloseButton?: boolean;
  closeOnOverlayPress?: boolean;
}

const sizeStyles = {
  sm: 'max-w-[320px]',
  md: 'max-w-[400px]',
  lg: 'max-w-[560px]',
  xl: 'max-w-[720px]',
  full: 'max-w-full mx-4',
};

export const Modal = ({
  visible,
  onClose,
  title,
  children,
  size = 'md',
  hideCloseButton = false,
  closeOnOverlayPress = true,
}: ModalProps) => {
  if (!visible) return null;

  return (
    <RNModal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill} onTouchStart={closeOnOverlayPress !== false ? onClose : undefined} />
      <View style={styles.container}>
        <View className={`bg-bgElevated rounded-xl overflow-hidden ${sizeStyles[size]}`} style={styles.modal}>
          {(title || !hideCloseButton) && (
            <View className="flex-row items-center justify-between p-4 border-b border-border">
              {title && <Text className="text-lg font-semibold text-text">{title}</Text>}
              {!hideCloseButton && (
                <TouchableOpacity onPress={onClose} className="p-2 rounded-lg">
                  <Text className="text-2xl text-textMuted">✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View className="p-4 max-h-[70vh] overflow-y-auto">
            {children}
          </View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    width: '100%',
  },
});
