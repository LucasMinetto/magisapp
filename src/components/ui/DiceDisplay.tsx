import React from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

export interface DiceResult {
  value: number;
  isCritical?: boolean;
  isSelected?: boolean;
}

export interface DiceRollAnimationProps {
  diceCount: number;
  sides: number;
  results: DiceResult[];
  onComplete?: () => void;
  duration?: number;
}

export const DiceDisplay = ({
  results,
  style,
  showTotal = true,
  size = 'md',
  color = '#3b82f6',
}: {
  results: DiceResult[];
  style?: any;
  showTotal?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}) => {
  const sizeMap: Record<'sm' | 'md' | 'lg', { die: number; font: number }> = {
    sm: { die: 32, font: 14 },
    md: { die: 48, font: 20 },
    lg: { die: 64, font: 28 },
  };

  const { die, font } = sizeMap[size];
  const total = results.reduce((sum, r) => sum + r.value, 0);
  const hasCritical = results.some((r) => r.isCritical);

  return (
    <View style={[styles.container, { gap: size === 'sm' ? 4 : 8 }, style]}>
      {results.map((result, index) => (
        <Animated.View
          key={index}
          style={[
            styles.die,
            { width: die, height: die, borderColor: result.isCritical ? '#f59e0b' : '#2a2a3e', borderWidth: result.isCritical ? 3 : 2 },
            { backgroundColor: result.isCritical ? '#1a1a2e' : '#0f0f1a' },
          ]}
        >
          <Text style={[
            styles.dieText,
            { fontSize: font, fontWeight: 'bold', color: result.isCritical ? '#f59e0b' : '#e8e8f0' },
          ]}>
            {result.value}
          </Text>
        </Animated.View>
      ))}
      {showTotal && results.length > 1 && (
        <View style={styles.totalWrapper}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={[
            styles.totalValue,
            { fontSize: font + 4, color: hasCritical ? '#f59e0b' : color },
          ]}>
            {total}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  die: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  dieText: {
    textAlign: 'center',
  },
  totalWrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: 8,
  },
  totalLabel: {
    fontSize: 10,
    color: '#8888a0',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalValue: {
    fontWeight: 'bold',
  },
});

export const DiceRoller = ({
  diceCount,
  sides,
  results,
  onComplete,
  duration = 1500,
}: DiceRollAnimationProps) => {
  const [animating, setAnimating] = React.useState(true);
  const [currentResults, setCurrentResults] = React.useState<DiceResult[]>([]);

  React.useEffect(() => {
    if (!animating) return;

    const interval = setInterval(() => {
      const newResults = Array.from({ length: results.length }, () => ({
        value: Math.floor(Math.random() * sides) + 1,
        isCritical: false,
        isSelected: false,
      }));
      setCurrentResults(newResults);
    }, 50);

    const timer = setTimeout(() => {
      clearInterval(interval);
      setCurrentResults(results);
      setAnimating(false);
      setTimeout(() => {
        if (onComplete) onComplete();
      }, 300);
    }, duration);

    return () => clearInterval(interval);
  }, [animating, results]);

  if (!animating) return null;

  return (
    <View style={rollerStyles.rollerContainer}>
      {currentResults.map((result, index) => (
        <Animated.View
          key={index}
          style={[
            styles.die,
            { width: 48, height: 48, transform: [{ rotate: `${Math.random() * 360}deg` }] },
          ]}
        >
          <Text style={[styles.dieText, { fontSize: 20, color: '#e8e8f0' }]}>
            {result.value}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
};

const rollerStyles = StyleSheet.create({
  rollerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
});