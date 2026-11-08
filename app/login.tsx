import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [campaignUrl, setCampaignUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username || !password || !campaignUrl) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    try {
      await login(username, password, campaignUrl);
      router.replace('/campanha');
    } catch (error) {
      Alert.alert('Erro', 'Falha no login');
    }
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (data.startsWith('http')) {
      setScannedUrl(data);
      setCampaignUrl(data);
      setScanning(false);
    }
  };

  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <BarCodeScanner
          onBarCodeScanned={handleBarcodeScanned}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Aponte para o QR Code do Mestre</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setScanning(false)}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>⚖️</Text>
        <Text style={styles.title}>Magistrado Celular</Text>
        <Text style={styles.subtitle}>App de jogadores para Ordem Paranormal RPG</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>Entrar na Campanha</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Usuário"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCompleteType="username"
        />
        
        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCompleteType="password"
        />
        
        <TextInput
          style={styles.input}
          placeholder="URL da Campanha (ou escaneie QR)"
          value={campaignUrl}
          onChangeText={setCampaignUrl}
          autoCapitalize="none"
          autoCompleteType="url"
        />
        
        <TouchableOpacity style={styles.scanButton} onPress={() => setScanning(true)}>
          <Text style={styles.scanButtonText}>📷 Escanear QR Code do Mestre</Text>
        </TouchableOpacity>

        {scannedUrl && (
          <Text style={styles.scannedInfo}>QR escaneado: {scannedUrl}</Text>
        )}

        <TouchableOpacity 
          style={styles.loginButton} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.loginButtonText}>Entrar</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
    padding: 24,
    justifyContent: 'center',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 64,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e8e8f0',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8888a0',
  },
  formContainer: {
    width: '100%',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e8e8f0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 16,
    color: '#e8e8f0',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  scanButton: {
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  scanButtonText: {
    color: '#a0a0c0',
    fontSize: 16,
  },
  scannedInfo: {
    color: '#4ade80',
    fontSize: 12,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    padding: 24,
    alignItems: 'center',
  },
  scannerText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 16,
  },
  cancelButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
  },
});