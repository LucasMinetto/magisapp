export * from './colors';
export * from './spacing';
export * from './typography';

export const theme = {
  colors: require('./colors').colors,
  spacing: require('./spacing').spacing,
  typography: require('./typography').typography,
} as const;