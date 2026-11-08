import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useArquivo } from '@/hooks/useArquivo';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type Aba = 'pessoas' | 'lugares' | 'anotacoes' | 'historico';

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'pessoas', rotulo: 'Pessoas' },
  { chave: 'lugares', rotulo: 'Lugares' },
  { chave: 'anotacoes', rotulo: 'Anotações' },
  { chave: 'historico', rotulo: 'Histórico' },
];

export default function ArquivoScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? user?.campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const {
    pessoas, lugares, anotacoes, historico,
    loading, error,
    savePessoa, updatePessoa, deletePessoa,
    saveLugar, deleteLugar,
    saveAnotacao, deleteAnotacao,
  } = useArquivo(campanha, userId);
  const [aba, setAba] = useState<Aba>('pessoas');
  const [novo, setNovo] = useState('');

  if (loading) return <Centered text="Carregando arquivo..." />;
  if (error) return <Centered text={error} error />;

  const adicionar = async () => {
    const nome = novo.trim();
    if (!nome) return;
    try {
      if (aba === 'pessoas') {
        await savePessoa({ campaignId: campanha, userId, nome, retratoUrl: null, oQueSabe: '' });
      } else if (aba === 'lugares') {
        await saveLugar({ campaignId: campanha, userId, nome, imagemUrl: null, descricaoPublica: '' });
      } else if (aba === 'anotacoes') {
        await saveAnotacao({
          campaignId: campanha, userId, titulo: nome, conteudo: '',
          linkedPessoaId: null, linkedLugarId: null,
        });
      }
      setNovo('');
    } catch {
      /* erro já fica em `error` do hook */
    }
  };

  const podeAdicionar = aba !== 'historico';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Arquivo da campanha</Text>

      <View style={styles.abas}>
        {ABAS.map((a) => (
          <TouchableOpacity
            key={a.chave}
            onPress={() => setAba(a.chave)}
            style={[styles.aba, aba === a.chave ? styles.abaAtiva : null]}
          >
            <Text style={[styles.abaTexto, aba === a.chave ? styles.abaTextoAtivo : null]}>{a.rotulo}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {podeAdicionar ? (
        <Card style={styles.card}>
          <CardContent>
            <Input
              label={aba === 'anotacoes' ? 'Título da anotação' : 'Nome'}
              value={novo}
              onChangeText={setNovo}
            />
            <TouchableOpacity style={styles.botao} onPress={adicionar}>
              <Text style={styles.botaoTexto}>Adicionar</Text>
            </TouchableOpacity>
          </CardContent>
        </Card>
      ) : null}

      {aba === 'pessoas' ? (
        pessoas.length === 0 ? <Vazio texto="Nenhuma pessoa registrada." /> : pessoas.map((p) => (
          <Card key={p.id} style={styles.card}>
            <CardContent>
              <Text style={styles.itemNome}>{p.nome}</Text>
              <Input
                label="O que sabemos"
                value={p.oQueSabe}
                multiline
                onChangeText={(v) => void updatePessoa(p.id, { oQueSabe: v })}
              />
              <TouchableOpacity onPress={() => void deletePessoa(p.id)} style={styles.remover}>
                <Text style={styles.removerTexto}>Remover</Text>
              </TouchableOpacity>
            </CardContent>
          </Card>
        ))
      ) : null}

      {aba === 'lugares' ? (
        lugares.length === 0 ? <Vazio texto="Nenhum lugar registrado." /> : lugares.map((l) => (
          <Card key={l.id} style={styles.card}>
            <CardContent>
              <Text style={styles.itemNome}>{l.nome}</Text>
              {l.descricaoPublica ? <Text style={styles.itemMeta}>{l.descricaoPublica}</Text> : null}
              <TouchableOpacity onPress={() => void deleteLugar(l.id)} style={styles.remover}>
                <Text style={styles.removerTexto}>Remover</Text>
              </TouchableOpacity>
            </CardContent>
          </Card>
        ))
      ) : null}

      {aba === 'anotacoes' ? (
        anotacoes.length === 0 ? <Vazio texto="Nenhuma anotação." /> : anotacoes.map((a) => (
          <Card key={a.id} style={styles.card}>
            <CardContent>
              <Text style={styles.itemNome}>{a.titulo}</Text>
              {a.conteudo ? <Text style={styles.itemMeta}>{a.conteudo}</Text> : null}
              <TouchableOpacity onPress={() => void deleteAnotacao(a.id)} style={styles.remover}>
                <Text style={styles.removerTexto}>Remover</Text>
              </TouchableOpacity>
            </CardContent>
          </Card>
        ))
      ) : null}

      {aba === 'historico' ? (
        historico.length === 0 ? <Vazio texto="Sem registros no histórico." /> : historico.map((h) => (
          <Card key={h.id} style={styles.card}>
            <CardContent>
              <Text style={styles.itemNome}>{h.titulo}</Text>
              <Text style={styles.itemMeta}>
                {h.tipo} · {h.autor} · {new Date(h.createdAt).toLocaleString('pt-BR')}
              </Text>
              {h.conteudo ? <Text style={styles.linha}>{h.conteudo}</Text> : null}
            </CardContent>
          </Card>
        ))
      ) : null}
    </ScrollView>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <Card style={styles.card}>
      <CardContent>
        <Text style={styles.vazio}>{texto}</Text>
      </CardContent>
    </Card>
  );
}

function Centered({ text, error }: { text: string; error?: boolean }) {
  return (
    <View style={styles.centered}>
      <Text style={[styles.centeredText, error ? styles.erro : null]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 16 },
  abas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  aba: { backgroundColor: '#1a1a2e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#2a2a3e' },
  abaAtiva: { borderColor: '#3b82f6' },
  abaTexto: { color: '#8888a0', fontWeight: '600', fontSize: 13 },
  abaTextoAtivo: { color: '#3b82f6' },
  card: { marginBottom: 12 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 10 },
  botaoTexto: { color: 'white', fontWeight: '600' },
  itemNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  itemMeta: { fontSize: 12, color: '#8888a0', marginTop: 2, marginBottom: 6 },
  linha: { fontSize: 13, color: '#c8c8d8', lineHeight: 20 },
  remover: { marginTop: 10, padding: 8, alignItems: 'center' },
  removerTexto: { color: '#ef4444' },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
