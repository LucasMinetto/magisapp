import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  fullScreen?: boolean;
}

const sizeMap: Record<'sm' | 'md' | 'lg', 'small' | 'large'> = {
  sm: 'small',
  md: 'small',
  lg: 'large',
};

export const Spinner = ({
  size = 'md',
  color = '#3b82f6',
  fullScreen = false,
}: SpinnerProps) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.inner}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.fullScreenText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  return <ActivityIndicator size={sizeMap[size]} color={color} />;
};

export const SpinnerOverlay = ({ visible, message = 'Carregando...' }: { visible: boolean; children?: React.ReactNode; message?: string }) => {
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]}>
      <View style={styles.overlayCard}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.overlayText}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f1a',
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  fullScreenText: {
    color: '#8888a0',
  },
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 50,
  },
  overlayCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  overlayText: {
    color: '#e8e8f0',
    textAlign: 'center',
  },
});
