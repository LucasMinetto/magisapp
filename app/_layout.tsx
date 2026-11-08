import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { parseDeepLinkUrl } from '@/hooks/useQRCode';
import { useAuthDB } from '@/hooks/useAuthDB';
import { ensureDatabaseReady, getDatabaseError } from '@/db';

export default function RootLayout() {
  const router = useRouter();
  const { saveCredentials, testConnection } = useAuthDB();
  const checkAuth = useAuth((state) => state.checkAuth);

  // useAuth starts with loading: true; without this the app would sit on a blank
  // screen forever waiting for a check that never runs.
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Prepara o banco (migrações + seed) antes de qualquer consulta das telas. O gate
  // em src/db/index.ts já espera por isso, mas disparar aqui deixa o boot explícito.
  useEffect(() => {
    void ensureDatabaseReady().catch((err: unknown) => {
      const message = getDatabaseError()?.message ?? (err instanceof Error ? err.message : String(err));
      Alert.alert('Erro ao preparar o banco', message, [
        {
          text: 'Tentar novamente',
          onPress: () => {
            void ensureDatabaseReady().catch(() => {
              /* erro fica exposto em getDatabaseError() */
            });
          },
        },
      ]);
    });
  }, []);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const result = parseDeepLinkUrl(url);
      if (!result.success || !result.payload) return;
      const credentials = {
        serverUrl: result.payload.serverUrl,
        username: result.payload.username,
        password: result.payload.password,
      };
      try {
        await saveCredentials(credentials);
        const connected = await testConnection(credentials);
        Alert.alert(
          connected ? 'Sucesso!' : 'Credenciais salvas',
          connected
            ? 'Credenciais configuradas e conexão testada com sucesso.'
            : 'Credenciais salvas, mas não foi possível conectar ao servidor.',
          [{ text: 'OK', onPress: () => router.replace('/campanha/sync') }]
        );
      } catch (e) {
        Alert.alert('Erro', (e as Error).message);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) void handleDeepLink(url);
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleDeepLink(url);
    });
    return () => subscription.remove();
  }, [router, saveCredentials, testConnection]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f0f1a' },
      }}
    />
  );
}
