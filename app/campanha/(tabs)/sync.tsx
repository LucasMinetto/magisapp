import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useAuthDB } from '@/hooks/useAuthDB';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type Estado = 'desconhecido' | 'verificando' | 'conectado' | 'erro';

export default function SyncScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const campanha = campaignId ?? user?.campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';

  const { syncCredentials, saveCredentials, testConnection } = useAuthDB();
  const { queue, pendingCount, refresh, retry, markProcessing, markSynced, markFailed } =
    useSyncQueue(campanha, userId);

  const [serverUrl, setServerUrl] = useState(syncCredentials?.serverUrl ?? '');
  const [username, setUsername] = useState(syncCredentials?.username ?? '');
  const [password, setPassword] = useState(syncCredentials?.password ?? '');
  const [estado, setEstado] = useState<Estado>('desconhecido');
  const [sincronizando, setSincronizando] = useState(false);

  const testar = useCallback(async () => {
    setEstado('verificando');
    const ok = await testConnection({ serverUrl, username, password });
    setEstado(ok ? 'conectado' : 'erro');
  }, [serverUrl, username, password, testConnection]);

  const salvar = useCallback(async () => {
    await saveCredentials({ serverUrl, username, password });
    await testar();
  }, [serverUrl, username, password, saveCredentials, testar]);

  const sincronizar = useCallback(async () => {
    if (sincronizando) return;
    setSincronizando(true);
    try {
      const pendentes = queue.filter((q) => q.status === 'pending' || q.status === 'failed');
      if (pendentes.length === 0) {
        await refresh();
        return;
      }
      const creds = { serverUrl, username, password };
      const auth = 'Basic ' + btoa(creds.username + ':' + creds.password);
      for (const item of pendentes) {
        await markProcessing(item.id);
        try {
          const resp = await fetch(creds.serverUrl + '/api/sync/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: auth },
            body: JSON.stringify({
              campaignId: item.campaignId,
              operacao: item.operacao,
              payload: item.payload,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (resp.ok) {
            await markSynced(item.id);
          } else {
            await markFailed(item.id, 'HTTP ' + String(resp.status));
          }
        } catch (e) {
          await markFailed(item.id, (e as Error).message);
        }
      }
      await refresh();
    } finally {
      setSincronizando(false);
    }
  }, [sincronizando, queue, serverUrl, username, password, markProcessing, markSynced, markFailed, refresh]);

  const corEstado = estado === 'conectado' ? '#22c55e' : estado === 'erro' ? '#ef4444' : '#8888a0';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Sincronização</Text>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Servidor do Mestre</Text>
          <View style={styles.stack}>
            <Input label="URL do servidor" value={serverUrl} onChangeText={setServerUrl} placeholder="https://sua-casa.duckdns.org" />
            <Input label="Usuário" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <Input label="Senha" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          <View style={styles.linhaEstado}>
            <View style={[styles.bolinha, { backgroundColor: corEstado }]} />
            <Text style={styles.estadoTexto}>
              {estado === 'conectado' ? 'Conectado' : estado === 'erro' ? 'Sem conexão' : estado === 'verificando' ? 'Verificando...' : 'Não testado'}
            </Text>
          </View>

          <View style={styles.botoes}>
            <TouchableOpacity style={[styles.botao, styles.botaoSecundario]} onPress={salvar}>
              <Text style={styles.botaoTexto}>Salvar e testar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botao} onPress={() => router.push('/campanha/sync/qr')}>
              <Text style={styles.botaoTexto}>Escanear QR</Text>
            </TouchableOpacity>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <View style={styles.cabecalho}>
            <Text style={styles.secao}>Fila</Text>
            <Text style={styles.pendentes}>{pendingCount} pendente{pendingCount === 1 ? '' : 's'}</Text>
          </View>

          {queue.length === 0 ? (
            <Text style={styles.vazio}>Nada na fila.</Text>
          ) : (
            queue.slice(0, 40).map((item) => (
              <View key={item.id} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemOperacao}>{item.operacao}</Text>
                  <Text style={styles.itemMeta}>
                    {item.status} · tentativas {item.tentativas}
                    {item.error ? ' · ' + item.error : ''}
                  </Text>
                </View>
                {item.status === 'failed' ? (
                  <TouchableOpacity onPress={() => void retry(item.id)} style={styles.acao}>
                    <Text style={styles.acaoTexto}>repetir</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}

          <TouchableOpacity
            style={[styles.botao, sincronizando ? styles.botaoDesativado : null]}
            onPress={sincronizar}
            disabled={sincronizando}
          >
            <Text style={styles.botaoTexto}>{sincronizando ? 'Sincronizando...' : 'Sincronizar agora'}</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Status</Text>
          <View style={styles.statsRow}>
            <Stat valor={queue.filter((q) => q.status === 'pending').length} rotulo="Pendentes" cor="#f59e0b" />
            <Stat valor={queue.filter((q) => q.status === 'processing').length} rotulo="Enviando" cor="#3b82f6" />
            <Stat valor={queue.filter((q) => q.status === 'synced').length} rotulo="Enviados" cor="#22c55e" />
            <Stat valor={queue.filter((q) => q.status === 'failed').length} rotulo="Falhas" cor="#ef4444" />
          </View>
        </CardContent>
      </Card>
    </ScrollView>
  );
}

function Stat({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValor, { color: cor }]}>{valor}</Text>
      <Text style={styles.statRotulo}>{rotulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 16 },
  card: { marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  stack: { gap: 10, marginTop: 12 },
  linhaEstado: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  estadoTexto: { color: '#e8e8f0', fontSize: 14 },
  botoes: { flexDirection: 'row', gap: 8, marginTop: 12 },
  botao: { flex: 1, backgroundColor: '#3b82f6', borderRadius: 8, padding: 14, alignItems: 'center' },
  botaoSecundario: { backgroundColor: '#2a2a4a' },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: 'white', fontWeight: '600' },
  cabecalho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  pendentes: { color: '#f59e0b', fontSize: 13, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 8 },
  itemInfo: { flex: 1 },
  itemOperacao: { color: '#e8e8f0', fontSize: 14, fontWeight: '600' },
  itemMeta: { color: '#8888a0', fontSize: 11, marginTop: 2 },
  acao: { padding: 8 },
  acaoTexto: { color: '#3b82f6', fontSize: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  stat: { flexGrow: 1, minWidth: 72, backgroundColor: '#0f0f1a', borderRadius: 10, padding: 12, alignItems: 'center' },
  statValor: { fontSize: 22, fontWeight: 'bold' },
  statRotulo: { color: '#8888a0', fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  vazio: { color: '#8888a0' },
});
