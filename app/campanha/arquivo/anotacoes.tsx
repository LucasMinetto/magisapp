import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Modal, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useArquivo } from '@/hooks/useArquivo';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

type ArquivoAnotacao = {
  id: string;
  campaignId: string;
  userId: string;
  titulo: string;
  conteudo: string;
  linkedPessoaId: string | null;
  linkedLugarId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ArquivoPessoa = {
  id: string;
  nome: string;
};

type ArquivoLugar = {
  id: string;
  nome: string;
};

interface SelectOption {
  value: string;
  label: string;
}

export default function AnotacoesScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const {
    anotacoes,
    pessoas,
    lugares,
    loading,
    error,
    saveAnotacao,
    updateAnotacao,
    deleteAnotacao,
    addHistorico,
  } = useArquivo(campanha, userId);

  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoConteudo, setNovoConteudo] = useState('');
  const [novoLinkedPessoa, setNovoLinkedPessoa] = useState<string>('');
  const [novoLinkedLugar, setNovoLinkedLugar] = useState<string>('');
  const [editando, setEditando] = useState<ArquivoAnotacao | null>(null);
  const [previewModal, setPreviewModal] = useState(false);

  const pessoasOptions: SelectOption[] = [{ value: '', label: 'Nenhuma' }, ...pessoas.map(p => ({ value: p.id, label: p.nome }))];
  const lugaresOptions: SelectOption[] = [{ value: '', label: 'Nenhum' }, ...lugares.map(l => ({ value: l.id, label: l.nome }))];

  const handleAdd = async () => {
    if (!novoTitulo.trim()) return;
    try {
      await saveAnotacao({
        campaignId: campanha,
        userId,
        titulo: novoTitulo.trim(),
        conteudo: novoConteudo,
        linkedPessoaId: novoLinkedPessoa || null,
        linkedLugarId: novoLinkedLugar || null,
      });
      await addHistorico({
        campaignId: campanha,
        userId,
        tipo: 'anotacao',
        refId: '',
        titulo: novoTitulo.trim(),
        conteudo: novoConteudo,
        autor: 'jogador',
      });
      setNovoTitulo('');
      setNovoConteudo('');
      setNovoLinkedPessoa('');
      setNovoLinkedLugar('');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  const handleSaveEdit = async (anotacao: ArquivoAnotacao) => {
    try {
      await updateAnotacao(anotacao.id, {
        titulo: anotacao.titulo,
        conteudo: anotacao.conteudo,
        linkedPessoaId: anotacao.linkedPessoaId,
        linkedLugarId: anotacao.linkedLugarId,
      });
      await addHistorico({
        campaignId: campanha,
        userId,
        tipo: 'anotacao',
        refId: anotacao.id,
        titulo: anotacao.titulo,
        conteudo: anotacao.conteudo,
        autor: 'jogador',
      });
      setEditando(null);
      Alert.alert('Sucesso', 'Anotação salva e versão registrada no histórico');
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Confirmar', 'Excluir esta anotação?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteAnotacao(id) },
    ]);
  };

  const handlePreview = (conteudo: string) => {
    if (Platform.OS === 'web') {
      Alert.alert('Pré-visualização', conteudo);
    } else {
      setPreviewModal(true);
    }
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
        <Text style={styles.titulo}>Anotações</Text>
      </View>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Nova Anotação</Text>
          <Input label="Título" value={novoTitulo} onChangeText={setNovoTitulo} placeholder="Título da anotação" />
          <Input label="Conteúdo (Markdown)" value={novoConteudo} onChangeText={setNovoConteudo} placeholder="Escreva sua anotação em Markdown..." multiline />
          <View style={styles.linkRow}>
            <SimpleSelect
              label="Pessoa"
              value={novoLinkedPessoa}
              onChange={setNovoLinkedPessoa}
              options={[{ value: '', label: 'Nenhuma' }, ...pessoas.map(p => ({ value: p.id, label: p.nome }))]}
              style={styles.select}
            />
            <SimpleSelect
              label="Lugar"
              value={novoLinkedLugar}
              onChange={setNovoLinkedLugar}
              options={[{ value: '', label: 'Nenhum' }, ...lugares.map(l => ({ value: l.id, label: l.nome }))]}
              style={styles.select}
            />
          </View>
          <TouchableOpacity style={styles.botao} onPress={handleAdd} disabled={!novoTitulo.trim()}>
            <Text style={styles.botaoTexto}>Adicionar</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>

      {anotacoes.length === 0 ? (
        <Card style={styles.card}><CardContent><Text style={styles.vazio}>Nenhuma anotação.</Text></CardContent></Card>
      ) : (
        anotacoes.map(a => (
          <Card key={a.id} style={styles.card}>
            <CardContent>
              {editando?.id === a.id ? (
                <>
                  <Input label="Título" value={a.titulo} onChangeText={v => setEditando({ ...a, titulo: v })} />
                  <Input label="Conteúdo" value={a.conteudo} onChangeText={v => setEditando({ ...a, conteudo: v })} multiline />
                  <View style={styles.linkRow}>
                    <SimpleSelect
                      label="Pessoa"
                      value={a.linkedPessoaId || ''}
                      onChange={(v: string) => setEditando({ ...a, linkedPessoaId: v || null })}
                      options={[{ value: '', label: 'Nenhuma' }, ...pessoas.map(p => ({ value: p.id, label: p.nome }))]}
                      style={styles.select}
                    />
                    <SimpleSelect
                      label="Lugar"
                      value={a.linkedLugarId || ''}
                      onChange={(v: string) => setEditando({ ...a, linkedLugarId: v || null })}
                      options={[{ value: '', label: 'Nenhum' }, ...lugares.map(l => ({ value: l.id, label: l.nome }))]}
                      style={styles.select}
                    />
                  </View>
                  <View style={styles.pessoaActions}>
                    <TouchableOpacity style={styles.botaoSalvar} onPress={() => handleSaveEdit(editando!)}>
                      <Text style={styles.botaoTexto}>Salvar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.botaoCancelar} onPress={() => setEditando(null)}>
                      <Text style={[styles.botaoTexto, { color: '#ef4444' }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.anotacaoHeader}>
                    <Text style={styles.anotacaoTitulo}>{a.titulo}</Text>
                    <Text style={styles.anotacaoData}>{new Date(a.updatedAt).toLocaleString('pt-BR')}</Text>
                  </View>
                  <Text style={styles.anotacaoConteudo}>{a.conteudo}</Text>
                  {(a.linkedPessoaId || a.linkedLugarId) && (
                    <View style={styles.anotacaoLinks}>
                      {a.linkedPessoaId && (
                        <View style={styles.linkBadge}>
                          <Ionicons name="person" size={14} color="#3b82f6" />
                          <Text style={styles.linkTexto}>
                            {pessoas.find(p => p.id === a.linkedPessoaId)?.nome || 'Pessoa'}
                          </Text>
                        </View>
                      )}
                      {a.linkedLugarId && (
                        <View style={styles.linkBadge}>
                          <Ionicons name="location" size={14} color="#f59e0b" />
                          <Text style={styles.linkTexto}>
                            {lugares.find(l => l.id === a.linkedLugarId)?.nome || 'Lugar'}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={styles.anotacaoActions}>
                    <TouchableOpacity style={styles.botaoEditar} onPress={() => { setEditando(a); handlePreview(a.conteudo); }}>
                      <Text style={styles.botaoTexto}>Editar / Visualizar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.botaoExcluir} onPress={() => handleDelete(a.id)}>
                      <Text style={[styles.botaoTexto, { color: '#ef4444' }]}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SimpleSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  style?: any;
}

const SimpleSelect = ({ label, value, onChange, options, style }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((opt: SelectOption) => opt.value === value);

  return (
    <View style={[styles.selectContainer, style]}>
      {label && <Text style={styles.selectLabel}>{label}</Text>}
      <TouchableOpacity onPress={() => setIsOpen(!isOpen)} style={styles.select}>
        <Text style={styles.selectText}>
          {value ? selectedOption?.label : 'Selecionar...'}
        </Text>
      </TouchableOpacity>
      {isOpen && (
        <Modal visible={isOpen} animationType="slide" transparent onRequestClose={() => setIsOpen(false)}>
          <View style={StyleSheet.absoluteFill} onTouchStart={() => setIsOpen(false)} />
          <View style={styles.dropdown}>
            {options.map((opt: any) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => { onChange(opt.value); setIsOpen(false); }}
                style={styles.option}
              >
                <Text style={styles.optionText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0' },
  card: { marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  linkRow: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 12 },
  select: { flex: 1 },
  selectContainer: { flex: 1 },
  selectLabel: { color: '#aaaaaa', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  selectInput: { backgroundColor: '#0f0f1a', borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  selectText: { color: '#e8e8f0', fontSize: 15 },
  dropdown: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1a1a2e', borderRadius: 8, marginBottom: 8, maxHeight: 200 },
  option: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  optionText: { color: '#e8e8f0', fontSize: 15 },
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
  anotacaoHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  anotacaoTitulo: { fontSize: 18, fontWeight: 'bold', color: '#e8e8f0' },
  anotacaoData: { color: '#8888a0', fontSize: 11 },
  anotacaoConteudo: { color: '#c8c8d8', fontSize: 14, lineHeight: 22, marginBottom: 8, marginTop: 8 },
  anotacaoLinks: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8, marginBottom: 8 },
  linkBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#1a1a2e', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a3e' },
  linkTexto: { color: '#c8c8d8', fontSize: 12 },
  anotacaoActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pessoaActions: { flexDirection: 'row', gap: 8 },
  botaoSalvarEdit: { backgroundColor: '#22c55e', borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  botaoCancelarEdit: { backgroundColor: '#2a2a3e', borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  botaoTextoEdit: { color: 'white', fontSize: 13, fontWeight: '600' },
});