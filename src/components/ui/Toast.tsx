import React, { useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => string;
  hideToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
  defaultDuration?: number;
}

const icons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const typeColors: Record<ToastType, string> = {
  success: 'rgba(34, 197, 94, 0.95)',
  error: 'rgba(239, 68, 68, 0.95)',
  warning: 'rgba(245, 158, 11, 0.95)',
  info: 'rgba(59, 130, 246, 0.95)',
};

const AnimatedToast = React.memo(({ toast, onClose }: { toast: Toast; onClose: () => void }) => {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -100, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) onClose(); });
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: typeColors[toast.type] },
        { transform: [{ translateX: slideAnim }], opacity: fadeAnim },
      ]}
    >
      <View style={styles.toastRow}>
        <Text style={styles.icon}>{icons[toast.type]}</Text>
        <Text style={styles.message}>{toast.message}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
});

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 5,
  defaultDuration = 4000,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = defaultDuration) => {
    const id = Math.random().toString(36).slice(2, 11);
    const newToast: Toast = { id, message, type, duration };
    setToasts((prev) => [...prev.slice(-(maxToasts - 1)), newToast]);
    return id;
  }, [maxToasts, defaultDuration]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast) => (
          <AnimatedToast key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'column',
    gap: 8,
  },
  toast: {
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minWidth: 280,
    maxWidth: '90%',
  },
  toastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    color: '#ffffff',
    fontSize: 18,
  },
  message: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
  },
  closeIcon: {
    color: '#ffffff',
    fontSize: 18,
  },
});
