import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal as RNModal, ViewStyle } from 'react-native';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  hideCloseButton?: boolean;
  closeOnOverlayPress?: boolean;
}

const sizeStyles: Record<NonNullable<ModalProps['size']>, ViewStyle> = {
  sm: { maxWidth: 320 },
  md: { maxWidth: 400 },
  lg: { maxWidth: 560 },
  xl: { maxWidth: 720 },
  full: { maxWidth: '100%', marginHorizontal: 16 },
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
        <View style={[styles.modal, sizeStyles[size]]}>
          {(title || !hideCloseButton) && (
            <View style={styles.header}>
              {title ? <Text style={styles.title}>{title}</Text> : <View />}
              {!hideCloseButton && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={styles.body}>
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
    borderWidth: 1,
    borderColor: '#2a2a3e',
    width: '100%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e8e8f0',
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
  },
  closeIcon: {
    fontSize: 22,
    color: '#8888a0',
  },
  body: {
    padding: 16,
    maxHeight: 560,
  },
});
