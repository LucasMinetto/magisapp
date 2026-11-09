import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useArquivo } from '@/hooks/useArquivo';
import { Card, CardContent } from '@/components/ui/Card';
import { Ionicons } from '@expo/vector-icons';

type ArquivoHistorico = {
  id: string;
  campaignId: string;
  userId: string;
  tipo: 'pessoa_v1' | 'lugar_v2' | 'interludio' | 'anotacao';
  refId: string;
  titulo: string;
  conteudo: string;
  autor: 'mestre' | 'jogador';
  createdAt: string;
};

const TIPO_ICONS: Record<string, string> = {
  pessoa_v1: 'person',
  lugar_v2: 'location',
  interludio: 'book',
  anotacao: 'document-text',
};

const TIPO_COLORS: Record<string, string> = {
  pessoa_v1: '#3b82f6',
  lugar_v2: '#f59e0b',
  interludio: '#8b5cf6',
  anotacao: '#22c55e',
};

const TIPO_LABELS: Record<string, string> = {
  pessoa_v1: 'Pessoa (NPC)',
  lugar_v2: 'Lugar',
  interludio: 'Interlúdio',
  anotacao: 'Anotação',
};

export default function HistoricoScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { historico, pessoas, lugares, loading, error } = useArquivo(campanha, userId);

  const historicoOrdenado = useMemo(() => {
    return [...historico].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [historico]);

  const historicoComDetalhes = useMemo(() => {
    return historicoOrdenado.map(h => {
      let refNome = 'Desconhecido';
      if (h.tipo === 'pessoa_v1') {
        refNome = pessoas.find(p => p.id === h.refId)?.nome || 'Pessoa removida';
      } else if (h.tipo === 'lugar_v2') {
        refNome = lugares.find(l => l.id === h.refId)?.nome || 'Lugar removido';
      } else if (h.tipo === 'anotacao') {
        refNome = h.titulo;
      } else {
        refNome = h.titulo;
      }
      return { ...h, refNome };
    });
  }, [historicoOrdenado, pessoas, lugares]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}><Text style={styles.loadingText}>Carregando histórico...</Text></View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Histórico Unificado</Text>
      </View>

      {historicoComDetalhes.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={64} color="#666680" />
          <Text style={styles.emptyText}>Nenhum registro no histórico.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.lista}>
          {historicoComDetalhes.map((h, index) => {
            const color = TIPO_COLORS[h.tipo] || '#666680';
            const icon = TIPO_ICONS[h.tipo] || 'help-outline';
            const label = TIPO_LABELS[h.tipo] || h.tipo;

            return (
              <TouchableOpacity key={h.id} style={styles.item} onPress={() => Alert.alert('Detalhes', h.conteudo || 'Sem conteúdo')}>
                <View style={[styles.timelineMarker, { borderLeftColor: color }]}>
                  <View style={[styles.timelineDot, { backgroundColor: color }]} />
                  {index < historicoComDetalhes.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.itemContent}>
                  <View style={styles.itemHeader}>
                    <View style={styles.itemTipo}>
                      <Ionicons name={icon as any} size={18} color={color} />
                      <Text style={[styles.itemTipoTexto, { color }]}>{label}</Text>
                    </View>
                    <Text style={styles.itemData}>
                      {new Date(h.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.itemTitulo}>{h.refNome}</Text>
                  <Text style={styles.itemConteudo} numberOfLines={3}>{h.conteudo || 'Sem conteúdo'}</Text>
                  <View style={styles.itemFooter}>
                    <Text style={[styles.itemAutor, { color }]}>{h.autor === 'mestre' ? '👑 Mestre' : '👤 Jogador'}</Text>
                    <Text style={styles.itemTipoBadge}>{h.tipo.replace('_', ' ')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

import { Alert } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { padding: 16, paddingBottom: 8 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0' },
  lista: { paddingHorizontal: 16, paddingBottom: 100 },
  item: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a3e' },
  timelineMarker: { position: 'absolute', left: -24, top: 0, bottom: 0, width: 2, borderLeftWidth: 2 },
  timelineDot: { position: 'absolute', left: -6, top: 0, width: 12, height: 12, borderRadius: 6 },
  timelineLine: { position: 'absolute', left: -1, top: 20, bottom: 0, width: 2, borderLeftWidth: 2, borderLeftColor: '#2a2a3e' },
  itemContent: { marginLeft: 20, flex: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTipo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTipoTexto: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  itemData: { color: '#666680', fontSize: 11 },
  itemTitulo: { fontSize: 16, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 8 },
  itemConteudo: { color: '#c8c8d8', fontSize: 13, lineHeight: 20, marginBottom: 8 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#2a2a3e' },
  itemAutor: { fontSize: 11, fontWeight: '600' },
  itemTipoBadge: { fontSize: 10, color: '#8888a0', backgroundColor: '#1a1a2e', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  emptyText: { color: '#8888a0', fontSize: 16, textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { color: '#8888a0' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', textAlign: 'center' },
});