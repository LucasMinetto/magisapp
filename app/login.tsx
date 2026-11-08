import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [campaignUrl, setCampaignUrl] = useState('');

  const handleLogin = async () => {
    if (!username || !password || !campaignUrl) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    try {
      await login(username, password, campaignUrl);
      router.replace('/campanha/ficha');
    } catch {
      Alert.alert('Erro', 'Falha no login');
    }
  };

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
          placeholderTextColor="#666680"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoComplete="username"
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#666680"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TextInput
          style={styles.input}
          placeholder="URL da Campanha"
          placeholderTextColor="#666680"
          value={campaignUrl}
          onChangeText={setCampaignUrl}
          autoCapitalize="none"
          autoComplete="url"
        />

        <TouchableOpacity style={styles.scanButton} onPress={() => router.push('/campanha/sync/qr')}>
          <Text style={styles.scanButtonText}>📷 Conectar pelo QR Code do Mestre</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.loginButtonText}>Entrar</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 24, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoText: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#8888a0', textAlign: 'center' },
  formContainer: { width: '100%', gap: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#e8e8f0', marginBottom: 8 },
  input: {
    backgroundColor: '#1a1a2e', borderRadius: 8, padding: 16, color: '#e8e8f0',
    fontSize: 16, borderWidth: 1, borderColor: '#2a2a4a',
  },
  scanButton: { backgroundColor: '#2a2a4a', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  scanButtonText: { color: '#a0a0c0', fontSize: 16 },
  loginButton: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 16 },
  loginButtonText: { color: 'white', fontSize: 18, fontWeight: '600' },
});
