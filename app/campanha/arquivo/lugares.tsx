import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useArquivo } from '@/hooks/useArquivo';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

type ArquivoLugar = {
  id: string;
  campaignId: string;
  userId: string;
  nome: string;
  imagemUrl: string | null;
  descricaoPublica: string;
  versaoAtual: number;
  updatedAt: string;
};

export default function LugaresScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { lugares, historico, loading, error, saveLugar, updateLugar, deleteLugar, addHistorico } = useArquivo(campanha, userId);

  const [novo, setNovo] = useState('');
  const [editando, setEditando] = useState<ArquivoLugar | null>(null);

  const handleAdd = async () => {
    const nome = novo.trim();
    if (!nome) return;
    try {
      await saveLugar({ campaignId: campanha, userId, nome, imagemUrl: null, descricaoPublica: '' });
      setNovo('');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  const handleSaveEdit = async (lugar: ArquivoLugar, descricaoPublica: string) => {
    try {
      await updateLugar(lugar.id, { descricaoPublica });
      await addHistorico({
        campaignId: campanha,
        userId,
        tipo: 'lugar_v2',
        refId: lugar.id,
        titulo: lugar.nome,
        conteudo: descricaoPublica,
        autor: 'jogador',
      });
      setEditando(null);
      Alert.alert('Sucesso', 'Alterações salvas e versão registrada no histórico');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Confirmar', 'Excluir este lugar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteLugar(id) },
    ]);
  };

  const handleVerHistorico = (lugar: ArquivoLugar) => {
    const hist = historico.filter(h => h.tipo === 'lugar_v2' && h.refId === lugar.id);
    setEditando(lugar);
  };

  if (loading) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.loading}><Text style={styles.loadingText}>Carregando...</Text></View>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Lugares</Text>
      </View>

      <Card style={styles.card}>
        <CardContent>
          <Input label="Nome do lugar" value={novo} onChangeText={setNovo} placeholder="Nome do lugar" />
          <TouchableOpacity style={styles.botao} onPress={handleAdd} disabled={!novo.trim()}>
            <Text style={styles.botaoTexto}>Adicionar</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>

      {lugares.length === 0 ? (
        <Card style={styles.card}><CardContent><Text style={styles.vazio}>Nenhum lugar registrado.</Text></CardContent></Card>
      ) : (
        lugares.map(l => (
          <Card key={l.id} style={styles.card}>
            <CardContent>
              <View style={styles.lugarHeader}>
                <Text style={styles.lugarNome}>{l.nome}</Text>
                <Text style={styles.lugarVersao}>v{l.versaoAtual}</Text>
              </View>
              <TextInput
                style={styles.textArea}
                value={l.descricaoPublica}
                onChangeText={v => setEditando(prev => prev?.id === l.id ? { ...prev, descricaoPublica: v } : prev)}
                multiline
                numberOfLines={4}
                editable={editando?.id === l.id}
                placeholder="Descrição pública..."
              />
              <View style={styles.lugarActions}>
                {editando?.id === l.id ? (
                  <>
                    <TouchableOpacity style={styles.botaoSalvar} onPress={() => handleSaveEdit(l, editando.descricaoPublica)}>
                      <Text style={styles.botaoTexto}>Salvar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.botaoCancelar} onPress={() => setEditando(null)}>
                      <Text style={[styles.botaoTexto, { color: '#ef4444' }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.botaoEditar} onPress={() => handleVerHistorico(l)}>
                      <Text style={styles.botaoTexto}>Editar / Histórico</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.botaoExcluir} onPress={() => handleDelete(l.id)}>
                      <Text style={[styles.botaoTexto, { color: '#ef4444' }]}>Excluir</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
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
  card: { marginBottom: 12 },
  textArea: { backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 8, padding: 12, color: '#e8e8f0', fontSize: 14, marginBottom: 12, marginTop: 8 },
  lugarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  lugarNome: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0' },
  lugarVersao: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  lugarActions: { flexDirection: 'row', gap: 8 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  botaoSalvar: { backgroundColor: '#22c55e', borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  botaoCancelar: { backgroundColor: '#2a2a3e', borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  botaoEditar: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  botaoExcluir: { backgroundColor: '#2a2a3e', borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  botaoTexto: { color: 'white', fontSize: 13, fontWeight: '600' },
  vazio: { color: '#8888a0', textAlign: 'center' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { color: '#8888a0' },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { color: '#ef4444', textAlign: 'center' },
});