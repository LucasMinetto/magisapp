import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function RootLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="campanha/(tabs)" />
          <Stack.Screen name="settings" />
        </>
      ) : (
        <>
          <Stack.Screen name="login" />
        </>
      )}
    </Stack>
  );
}