import { Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { parseDeepLinkUrl } from '@/hooks/useQRCode';
import { useAuthDB } from '@/hooks/useAuthDB';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

export default function RootLayout() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { saveCredentials, testConnection } = useAuthDB();

  // Handle deep links
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const result = parseDeepLinkUrl(url);
      if (result.success && result.payload) {
        try {
          // Save credentials to auth DB
          const credentials = {
            serverUrl: result.payload.serverUrl,
            username: result.payload.username,
            password: result.payload.password,
          };

          await saveCredentials(credentials);
          const connected = await testConnection(credentials);

          Alert.alert(
            connected ? 'Sucesso!' : 'Credenciais Salvas',
            connected
              ? 'Credenciais configuradas e conexão testada com sucesso.'
              : 'Credenciais salvas, mas não foi possível conectar ao servidor. Verifique a URL e tente sincronizar.',
            [{ text: 'OK', onPress: () => router.replace('/campanha/sync') }]
          );
        } catch (e) {
          Alert.alert('Erro', (e as Error).message);
        }
      }
    };

    // Check initial URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Listen for incoming links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [router, saveCredentials, testConnection]);

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