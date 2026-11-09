import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useArquivo } from '@/hooks/useArquivo';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

type ArquivoPessoa = {
  id: string;
  campaignId: string;
  userId: string;
  nome: string;
  retratoUrl: string | null;
  oQueSabe: string;
  versaoAtual: number;
  updatedAt: string;
};

export default function PessoasScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { pessoas, historico, loading, error, savePessoa, updatePessoa, deletePessoa, addHistorico } = useArquivo(campanha, userId);

  const [novo, setNovo] = useState('');
  const [editando, setEditando] = useState<ArquivoPessoa | null>(null);
  const [versoes, setVersoes] = useState<{ id: string; versao: number; oQueSabe: string; data: string }[]>([]);

  const handleAdd = async () => {
    const nome = novo.trim();
    if (!nome) return;
    try {
      await savePessoa({ campaignId: campanha, userId, nome, retratoUrl: null, oQueSabe: '' });
      setNovo('');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  const handleSaveEdit = async (pessoa: ArquivoPessoa, oQueSabe: string) => {
    try {
      await updatePessoa(pessoa.id, { oQueSabe });
      await addHistorico({
        campaignId: campanha,
        userId,
        tipo: 'pessoa_v1',
        refId: pessoa.id,
        titulo: pessoa.nome,
        conteudo: oQueSabe,
        autor: 'jogador',
      });
      setEditando(null);
      Alert.alert('Sucesso', 'Alterações salvas e versão registrada no histórico');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Confirmar', 'Excluir esta pessoa?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deletePessoa(id) },
    ]);
  };

  const handleVerHistorico = (pessoa: ArquivoPessoa) => {
    const hist = historico.filter(h => h.tipo === 'pessoa_v1' && h.refId === pessoa.id);
    setVersoes(hist.map(h => ({
      id: h.id,
      versao: parseInt(h.titulo.replace('v', '')) || 1,
      oQueSabe: h.conteudo,
      data: h.createdAt,
    })));
    setEditando(pessoa);
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
        <Text style={styles.titulo}>Pessoas (NPCs)</Text>
      </View>

      <Card style={styles.card}>
        <CardContent>
          <Input label="Nome do NPC" value={novo} onChangeText={setNovo} placeholder="Nome do NPC" />
          <TouchableOpacity style={styles.botao} onPress={handleAdd} disabled={!novo.trim()}>
            <Text style={styles.botaoTexto}>Adicionar</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>

      {pessoas.length === 0 ? (
        <Card style={styles.card}><CardContent><Text style={styles.vazio}>Nenhuma pessoa registrada.</Text></CardContent></Card>
      ) : (
        pessoas.map(p => (
          <Card key={p.id} style={styles.card}>
            <CardContent>
              <View style={styles.pessoaHeader}>
                <Text style={styles.pessoaNome}>{p.nome}</Text>
                <Text style={styles.pessoaVersao}>v{p.versaoAtual}</Text>
              </View>
              <TextInput
                style={styles.textArea}
                value={p.oQueSabe}
                onChangeText={v => setEditando(prev => prev?.id === p.id ? { ...prev, oQueSabe: v } : prev)}
                multiline
                numberOfLines={4}
                editable={editando?.id === p.id}
                placeholder="O que sabemos..."
              />
              <View style={styles.pessoaActions}>
                {editando?.id === p.id ? (
                  <>
                    <TouchableOpacity style={styles.botaoSalvar} onPress={() => handleSaveEdit(p, editando.oQueSabe)}>
                      <Text style={styles.botaoTexto}>Salvar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.botaoCancelar} onPress={() => setEditando(null)}>
                      <Text style={[styles.botaoTexto, { color: '#ef4444' }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.botaoEditar} onPress={() => handleVerHistorico(p)}>
                      <Text style={styles.botaoTexto}>Editar / Histórico</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.botaoExcluir} onPress={() => handleDelete(p.id)}>
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
  pessoaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pessoaNome: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0' },
  pessoaVersao: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  pessoaActions: { flexDirection: 'row', gap: 8 },
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