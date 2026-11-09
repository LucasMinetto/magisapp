import { Stack } from 'expo-router';

export default function RolagemLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f0f1a' },
      }}
    />
  );
}