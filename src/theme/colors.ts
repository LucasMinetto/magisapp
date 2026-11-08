export const colors = {
  bg: '#0f0f1a',
  bgElevated: '#1a1a2e',
  border: '#1a1a2e',
  accent: '#3b82f6',
  accentHover: '#2563eb',
  text: '#e8e8f0',
  textMuted: '#8888a0',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  pv: '#22c55e',
  pe: '#3b82f6',
  san: '#f43f5e',
} as const;

export type ColorKey = keyof typeof colors;