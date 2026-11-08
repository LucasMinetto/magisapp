import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { useAuthDB } from '@/hooks/useAuthDB';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';
import { QRCodeGenerator } from '@/components/sync/QRCodeGenerator';
import { useRouter } from 'expo-router';

export default function SyncScreen() {
  const router = useRouter();
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { queue, loading, error, getPending, markSynced, clearSynced, forcePush } = useSyncQueue(campaignId || '', '');
  const { syncCredentials, loading: authLoading, error: authError, saveCredentials, testConnection } = useAuthDB();
  const [serverUrl, setServerUrl] = useState(syncCredentials?.serverUrl || '');
  const [username, setUsername] = useState(syncCredentials?.username || '');
  const [password, setPassword] = useState('');
  const [showCreds, setShowCreds] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'checking' | 'connected' | 'error'>('unknown');

  useEffect(() => {
    if (syncCredentials) {
      setServerUrl(syncCredentials.serverUrl || '');
      setUsername(syncCredentials.username || '');
    }
    checkConnection();
  }, [syncCredentials]);

  const checkConnection = useCallback(async () => {
    if (!serverUrl || !username) return;
    setConnectionStatus('checking');
    try {
      const result = await testConnection();
      setConnectionStatus(result ? 'connected' : 'error');
      if (result) setLastSync(new Date().toISOString());
    } catch {
      setConnectionStatus('error');
    }
  }, [serverUrl, username, testConnection]);

  const handleSaveCreds = async () => {
    if (!serverUrl || !username || !password) return;
    await saveCredentials({ serverUrl, username, password });
    setPassword('');
    setShowCreds(false);
    checkConnection();
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await forcePush();
      setLastSync(new Date().toISOString());
    } catch (e) {
      Alert.alert('Erro no Sync', (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleShowQR = () => {
    if (syncCredentials?.serverUrl && syncCredentials?.username && syncCredentials?.password && campaignId) {
      setShowQR(true);
    }
  };

  const handleScanQR = () => {
    router.push('/campanha/sync/qr');
  };

  const pending = getPending();

  if (authLoading) return <LoadingView />;
  if (authError) return <ErrorView message={authError} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Sincronização</Text>
      </View>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Conexão com o Mestre</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, connectionStatus === 'connected' && styles.statusDotConnected, connectionStatus === 'error' && styles.statusDotError]} />
            <Text style={styles.statusText}>
              {connectionStatus === 'checking' ? 'Verificando...' :
               connectionStatus === 'connected' ? 'Conectado' :
               connectionStatus === 'error' ? 'Erro de conexão' : 'Não configurado'}
            </Text>
          </View>
          {lastSync && <Text style={styles.lastSync}>Último sync: {new Date(lastSync).toLocaleString('pt-BR')}</Text>}

          {!syncCredentials?.serverUrl && (
            <View style={styles.credsSection}>
              <Text style={styles.credsTitle}>Configurar Credenciais</Text>
              <Input label="URL do Servidor" value={serverUrl} onChangeText={setServerUrl} placeholder="https://seu-servidor.duckdns.org" />
              <Input label="Usuário" value={username} onChangeText={setUsername} />
              <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry />
              <TouchableOpacity onPress={handleSaveCreds} style={styles.saveButton} disabled={!serverUrl || !username || !password}>
                <Text style={styles.saveButtonText}>Salvar e Testar</Text>
              </TouchableOpacity>
            </View>
          )}
          {syncCredentials?.serverUrl && (
            <>
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={() => setShowCreds(!showCreds)} style={styles.toggleCreds}>
                  <Text style={styles.toggleCredsText}>{showCreds ? 'Ocultar' : 'Alterar'} credenciais</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShowQR} style={styles.qrButton}>
                  <Ionicons name="qr-code-outline" size={20} color="#3b82f6" style={{ marginRight: 6 }} />
                  <Text style={styles.qrButtonText}>Mostrar QR Code</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handleScanQR} style={styles.scanButton}>
                <Ionicons name="camera-outline" size={20} color="#22c55e" style={{ marginRight: 6 }} />
                <Text style={styles.scanButtonText}>Escanear QR de Outro Dispositivo</Text>
              </TouchableOpacity>
            </>
          )}
          {showCreds && syncCredentials?.serverUrl && (
            <View style={styles.credsSection}>
              <Input label="URL do Servidor" value={serverUrl} onChangeText={setServerUrl} />
              <Input label="Usuário" value={username} onChangeText={setUsername} />
              <Input label="Nova Senha" value={password} onChangeText={setPassword} secureTextEntry placeholder="Deixe em branco para manter" />
              <TouchableOpacity onPress={handleSaveCreds} style={styles.saveButton} disabled={!serverUrl || !username}>
                <Text style={styles.saveButtonText}>Atualizar</Text>
              </TouchableOpacity>
            </View>
          )}

          {showQR && syncCredentials && (
            <QRCodeGenerator
              payload={{
                serverUrl: syncCredentials.serverUrl,
                username: syncCredentials.username,
                password: syncCredentials.password,
                campaignId: campaignId || '',
              }}
              onCopyDeepLink={() => {
                Alert.alert('Link copiado', 'O link de sincronização foi copiado para a área de transferência');
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <View style={styles.syncHeader}>
            <Text style={styles.sectionTitle}>Fila de Sincronização</Text>
            <Text style={styles.pendingCount}>{pending.length} pendente{pending.length !== 1 ? 's' : ''}</Text>
          </View>

          {pending.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#22c55e" />
              <Text style={styles.emptyText}>Tudo sincronizado!</Text>
            </View>
          ) : (
            <View style={styles.queueList}>
              {pending.map((item) => (
                <SyncQueueItem key={item.id} item={item} onRetry={() => {}} />
              ))}
            </View>
          )}

          <TouchableOpacity onPress={handleSync} style={[styles.syncButton, syncing && styles.syncButtonDisabled]} disabled={syncing || pending.length === 0}>
            <Ionicons name={syncing ? 'refresh' : 'sync'} size={24} color="white" style={{ marginRight: 8, transform: syncing ? [{ rotate: '360deg' }] : [] }} />
            <Text style={styles.syncButtonText}>{syncing ? 'Sincronizando...' : 'Sincronizar Agora'}</Text>
          </TouchableOpacity>

          {queue.length > 0 && (
            <TouchableOpacity onPress={() => { clearSynced(); }} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>Limpar sincronizados ({queue.filter((q: any) => q.status === 'synced').length})</Text>
            </TouchableOpacity>
          )}
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Status Detalhado</Text>
          <View style={styles.statusGrid}>
            <StatusBox label="Pendentes" value={queue.filter((q: any) => q.status === 'pending').length} color="#f59e0b" />
            <StatusBox label="Enviando" value={queue.filter((q: any) => q.status === 'sending').length} color="#3b82f6" />
            <StatusBox label="Sincronizados" value={queue.filter((q: any) => q.status === 'synced').length} color="#22c55e" />
            <StatusBox label="Erro" value={queue.filter((q: any) => q.status === 'error').length} color="#ef4444" />
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function SyncQueueItem({ item, onRetry }: { item: any; onRetry: () => void }) {
  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    sending: '#3b82f6',
    synced: '#22c55e',
    error: '#ef4444',
  };

  return (
    <View style={styles.queueItem}>
      <View style={styles.queueItemLeft}>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
          <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
        </View>
        <View style={styles.queueItemInfo}>
          <Text style={styles.queueItemTable}>{item.tabela}</Text>
          <Text style={styles.queueItemOp}>{item.operacao} | Tentativa {item.tentativas}/{item.max_tentativas}</Text>
        </View>
      </View>
      {item.status === 'error' && (
        <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
          <Ionicons name="refresh" size={20} color="#3b82f6" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function StatusBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statusBox}>
      <Text style={[styles.statusBoxValue, { color }]}>{value}</Text>
      <Text style={styles.statusBoxLabel}>{label}</Text>
    </View>
  );
}

function LoadingView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0' }}>Carregando...</Text></View>; }
function ErrorView({ message }: { message: string }) { return <View style={styles.centerContainer}><Text style={{ color: '#ef4444', textAlign: 'center' }}>{message}</Text></View>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0' },
  card: { marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#8888a0' },
  statusDotConnected: { backgroundColor: '#22c55e' },
  statusDotError: { backgroundColor: '#ef4444' },
  statusText: { fontSize: 14, color: '#e8e8f0' },
  lastSync: { fontSize: 11, color: '#8888a0', marginTop: 4 },
  credsSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a2a3e' },
  credsTitle: { fontSize: 14, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  saveButton: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  toggleCreds: { marginTop: 8, padding: 8 },
  toggleCredsText: { fontSize: 13, color: '#3b82f6' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
  qrButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#3b82f6', borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  qrButtonText: { color: '#3b82f6', fontWeight: '600', fontSize: 14 },
  scanButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#22c55e', borderRadius: 8, backgroundColor: 'rgba(34, 197, 94, 0.1)', marginTop: 8 },
  scanButtonText: { color: '#22c55e', fontWeight: '600', fontSize: 14 },
  syncHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pendingCount: { fontSize: 13, color: '#f59e0b', fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 30, gap: 8 },
  emptyText: { fontSize: 16, color: '#8888a0' },
  queueList: { gap: 8, marginBottom: 12 },
  queueItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12 },
  queueItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, minWidth: 70, alignItems: 'center' },
  statusBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  queueItemInfo: { gap: 2 },
  queueItemTable: { fontSize: 13, fontWeight: '600', color: '#e8e8f0' },
  queueItemOp: { fontSize: 11, color: '#8888a0' },
  retryButton: { padding: 8 },
  syncButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, marginBottom: 8 },
  syncButtonDisabled: { opacity: 0.6 },
  syncButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  clearButton: { padding: 12, alignItems: 'center' },
  clearButtonText: { fontSize: 13, color: '#8888a0' },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statusBox: { flex: 1, minWidth: 80, backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, alignItems: 'center' },
  statusBoxValue: { fontSize: 28, fontWeight: 'bold' },
  statusBoxLabel: { fontSize: 11, color: '#8888a0', marginTop: 4, textAlign: 'center' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});