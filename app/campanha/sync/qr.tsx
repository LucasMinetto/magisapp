import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  ScrollView,
} from 'react-native';
import { BarCodeScanner, BarCodeScannerResult } from 'expo-barcode-scanner';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useAuthDB } from '@/hooks/useAuthDB';
import { parseDeepLinkUrl, QRCodePayload } from '@/hooks/useQRCode';

export default function QRScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ campaignId?: string; data?: string }>();
  const { saveCredentials, testConnection } = useAuthDB();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [campaignId, setCampaignId] = useState(params.campaignId || '');

  // If deep link data is passed, parse it immediately
  useEffect(() => {
    if (params.data && !scanned) {
      handleDeepLinkData(params.data);
    }
  }, [params.data, scanned]);

  const requestCameraPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
    } else {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    }
  }, []);

  useEffect(() => {
    requestCameraPermission();
  }, [requestCameraPermission]);

  const handleDeepLinkData = async (data: string) => {
    const result = parseDeepLinkUrl(`magistrado://sync?data=${data}`);
    if (result.success && result.payload) {
      await handleScannedPayload(result.payload);
    } else {
      Alert.alert('QR Inválido', result.error || 'Não foi possível ler o QR code');
      setScanned(false);
    }
  };

  const handleBarCodeScanned = async (result: BarCodeScannerResult) => {
    if (scanned || !result.data) return;
    setScanned(true);

    // Try to parse as deep link URL first
    const parsed = parseDeepLinkUrl(result.data);
    if (parsed.success && parsed.payload) {
      await handleScannedPayload(parsed.payload);
    } else {
      // Try to parse as raw base64
      const base64Result = parseDeepLinkUrl(`magistrado://sync?data=${result.data}`);
      if (base64Result.success && base64Result.payload) {
        await handleScannedPayload(base64Result.payload);
      } else {
        Alert.alert('QR Inválido', 'O QR code escaneado não contém dados de sincronização válidos');
        setScanned(false);
      }
    }
  };

  const handleScannedPayload = async (payload: QRCodePayload) => {
    setLoading(true);
    try {
      const credentials = {
        serverUrl: payload.serverUrl,
        username: payload.username,
        password: payload.password,
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
      setScanned(false);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async () => {
    if (!serverUrl || !username || !password || !campaignId) {
      Alert.alert('Campos Obrigatórios', 'Preencha todos os campos');
      return;
    }

    setLoading(true);
    try {
      const credentials = { serverUrl, username, password };
      await saveCredentials(credentials);
      const connected = await testConnection(credentials);

      Alert.alert(
        connected ? 'Sucesso!' : 'Salvo',
        connected
          ? 'Conexão testada com sucesso.'
          : 'Credenciais salvas, mas conexão falhou. Verifique a URL.',
        [{ text: 'OK', onPress: () => router.replace('/campanha/sync') }]
      );
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="camera-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Permissão de câmera negada</Text>
        <Text style={styles.errorSubtext}>
          Habilite a câmera nas configurações do app para escanear QR codes
        </Text>
        <TouchableOpacity onPress={requestCameraPermission} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setManualEntry(true)} style={styles.manualButton}>
          <Text style={styles.manualButtonText}>Inserir Manualmente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!manualEntry ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Escanear QR de Sincronização</Text>
            <Text style={styles.subtitle}>
              Aponte a câmera para o QR code do Mestre
            </Text>
          </View>

          <View style={styles.scannerContainer}>
            <BarCodeScanner
              onBarCodeScanned={handleBarCodeScanned}
              style={StyleSheet.absoluteFill}
              barCodeTypes={['qr']}
            />
            <View style={[styles.scanOverlay, StyleSheet.absoluteFill]}>
              <View style={styles.scanFrame}>
                <View style={styles.corner} />
                <View style={styles.corner} />
                <View style={styles.corner} />
                <View style={styles.corner} />
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>O QR será detectado automaticamente</Text>
            <TouchableOpacity onPress={() => setManualEntry(true)} style={styles.manualButton}>
              <Text style={styles.manualButtonText}>Inserir Credenciais Manualmente</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.manualContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Configuração Manual</Text>
            <TouchableOpacity onPress={() => setManualEntry(false)} style={styles.backButton}>
              <Ionicons name="arrow-back-outline" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Card style={styles.card}>
              <CardContent>
                <Input
                  label="URL do Servidor"
                  value={serverUrl}
                  onChangeText={setServerUrl}
                  placeholder="https://seu-servidor.duckdns.org"
                  keyboardType="url"
                />
                <Input
                  label="Usuário"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                />
                <Input
                  label="Senha"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <Input
                  label="ID da Campanha"
                  value={campaignId}
                  onChangeText={setCampaignId}
                  placeholder="campaign-123"
                />
              </CardContent>
            </Card>

            <TouchableOpacity
              onPress={handleManualSave}
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Salvar e Testar Conexão</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  loadingText: {
    color: '#8888a0',
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e8e8f0',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 14,
    color: '#8888a0',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  manualButton: {
    paddingVertical: 8,
  },
  manualButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a3e',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e8e8f0',
  },
  subtitle: {
    fontSize: 14,
    color: '#8888a0',
    marginTop: 4,
  },
  backButton: {
    padding: 8,
  },
  scannerContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  scanOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    fontSize: 13,
    color: '#8888a0',
  },
  manualContainer: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    gap: 16,
    paddingBottom: 24,
  },
  card: {
    marginBottom: 0,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
    saveButtonText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 16,
    },
  });