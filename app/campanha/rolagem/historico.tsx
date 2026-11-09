import React, { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useRolagens } from '@/hooks/useRolagens';
import { Card, CardContent } from '@/components/ui/Card';

const TIPO_LABELS: Record<string, string> = {
  teste: 'Teste',
  ataque: 'Ataque',
  dano: 'Dano',
  ritual: 'Ritual',
  livre: 'Livre',
};

const TIPO_COLORS: Record<string, string> = {
  teste: '#3b82f6',
  ataque: '#ef4444',
  dano: '#f59e0b',
  ritual: '#8b5cf6',
  livre: '#22c55e',
};

export default function HistoricoScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { rolagens, loading, deleteRolagem, clearHistorico, refresh } = useRolagens(campanha, userId);

  const handleDelete = async (id: string) => {
    Alert.alert('Confirmar', 'Excluir esta rolagem?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteRolagem(id) },
    ]);
  };

  const handleClear = () => {
    Alert.alert('Confirmar', 'Limpar todo o histórico?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: clearHistorico },
    ]);
  };

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.titulo}>Histórico de Rolagens</Text>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Histórico</Text>
        {rolagens.length > 0 && (
          <TouchableOpacity style={styles.clearBotao} onPress={handleClear}>
            <Text style={styles.clearBotaoTexto}>Limpar tudo</Text>
          </TouchableOpacity>
        )}
      </View>

      {rolagens.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>Nenhuma rolagem registrada.</Text>
          </CardContent>
        </Card>
      ) : (
        rolagens.map((r) => (
          <Card key={r.id} style={styles.card}>
            <CardContent>
              <View style={styles.rolagemHeader}>
                <View style={styles.rolagemTipo}>
                  <View
                    style={[
                      styles.tipoBadge,
                      { backgroundColor: TIPO_COLORS[r.tipo] || '#666680' },
                    ]}
                  />
                  <Text style={styles.tipoTexto}>{TIPO_LABELS[r.tipo] || r.tipo}</Text>
                </View>
                <Text style={styles.rolagemData}>
                  {new Date(r.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              {r.rotulo && <Text style={styles.rolagemRotulo}>{r.rotulo}</Text>}

              <Text style={styles.rolagemFormula}>{r.formula}</Text>

              <View style={styles.rolagemResultado}>
                <Text style={styles.rolagemTotal}>{r.total}</Text>
                <Text style={styles.rolagemDados}>
                  [{r.dados.join(', ')}]
                </Text>
              </View>

              <View style={styles.rolagemFlags}>
                {r.critico && (
                  <View style={[styles.flag, styles.flagCritico]}>
                    <Text style={styles.flagTexto}>✦ Crítico</Text>
                  </View>
                )}
                {r.falha && (
                  <View style={[styles.flag, styles.flagFalha]}>
                    <Text style={styles.flagTexto}>✕ Falha</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(r.id)}>
                <Text style={styles.deleteBtnTexto}>Excluir</Text>
              </TouchableOpacity>
            </CardContent>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0' },
  clearBotao: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#2a2a3e', borderRadius: 8 },
  clearBotaoTexto: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  card: { marginBottom: 12 },
  vazio: { color: '#8888a0', textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { color: '#8888a0' },
  rolagemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rolagemTipo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tipoBadge: { width: 10, height: 10, borderRadius: 5 },
  tipoTexto: { color: '#a0a0c0', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  rolagemData: { color: '#666680', fontSize: 11 },
  rolagemRotulo: { color: '#e8e8f0', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  rolagemFormula: { color: '#8888a0', fontSize: 13, fontFamily: 'monospace', marginBottom: 8 },
  rolagemResultado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingVertical: 8, backgroundColor: '#0f0f1a', borderRadius: 8, paddingHorizontal: 12 },
  rolagemTotal: { color: '#3b82f6', fontSize: 24, fontWeight: 'bold' },
  rolagemDados: { color: '#8888a0', fontSize: 12, fontFamily: 'monospace' },
  rolagemFlags: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  flag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  flagCritico: { backgroundColor: '#8b5cf6', opacity: 0.2 },
  flagFalha: { backgroundColor: '#ef4444', opacity: 0.2 },
  flagTexto: { color: '#a0a0c0', fontSize: 11, fontWeight: '600' },
  deleteBtn: { marginTop: 8, padding: 8, alignItems: 'center', backgroundColor: '#2a2a3e', borderRadius: 8 },
  deleteBtnTexto: { color: '#ef4444', fontSize: 12 },
});