import React from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';

interface PVPECardProps {
  label: string;
  current: number;
  max: number;
  color: 'pv' | 'pe' | 'san';
  style?: any;
  onPress?: () => void;
}

const colorConfig = {
  pv: { border: '#22c55e', text: '#22c55e', icon: '❤', warn: '#f59e0b' },
  pe: { border: '#3b82f6', text: '#3b82f6', icon: '⚡', warn: '#f59e0b' },
  san: { border: '#f43f5e', text: '#f43f5e', icon: '🧠', warn: '#f59e0b' },
};

export const PVPECard = ({
  label,
  current,
  max,
  color,
  style,
  onPress,
}: PVPECardProps) => {
  const colors = colorConfig[color];
  const percent = max > 0 ? Math.round((current / max) * 100) : 0;
  const isLow = percent < 25;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[{ flex: 1 }, style]}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconLabel}>
            <Text style={styles.icon}>{getIcon(color)}</Text>
            <Text style={styles.label}>{label}</Text>
          </View>
          <Text style={[styles.value, { color: isLow ? '#f59e0b' : colors.text }]}>
            {current}/{max}
          </Text>
        </View>
        <View style={styles.barContainer}>
          <Animated.View
            style={[
              styles.bar,
              { backgroundColor: isLow ? '#f59e0b' : colors.text },
              { width: `${Math.min(percent, 100)}%` },
            ]}
          />
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>{current}</Text>
          <Text style={styles.footerText}>{percent}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getIcon(color: 'pv' | 'pe' | 'san') {
  switch (color) {
    case 'pv': return '❤';
    case 'pe': return '⚡';
    case 'san': return '🧠';
    default: return '❤';
  }
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8e8f0',
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
  },
  barContainer: {
    height: 6,
    backgroundColor: '#1a1a2e',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  bar: {
    height: '100%',
    borderRadius: 3,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  footerText: {
    fontSize: 11,
    color: '#8888a0',
  },
});
