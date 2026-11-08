import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

function novoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function FichaHabilidadesScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? user?.campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const { ficha, loading, error, saveFicha } = useFicha(campanha, userId);
  const [nome, setNome] = useState('');
  const [fonte, setFonte] = useState('');

  if (loading) return <Centered text="Carregando..." />;
  if (error) return <Centered text={error} error />;
  if (!ficha) return <Centered text="Nenhuma ficha nesta campanha ainda." />;

  const atualizar = (patch: Partial<NonNullable<typeof ficha>>) => {
    void saveFicha({ ...ficha, ...patch });
  };

  const adicionar = () => {
    const n = nome.trim();
    if (!n) return;
    atualizar({
      habilidades: [
        ...ficha.habilidades,
        { id: novoId(), nome: n, fonte: fonte.trim() || 'Poder', custo: '', descricao: '' },
      ],
    });
    setNome('');
    setFonte('');
  };

  const remover = (id: string) => {
    atualizar({ habilidades: ficha.habilidades.filter((h) => h.id !== id) });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Adicionar habilidade</Text>
          <View style={styles.stack}>
            <Input label="Nome" value={nome} onChangeText={setNome} placeholder="Ex.: Reflexos de Combate" />
            <Input label="Fonte" value={fonte} onChangeText={setFonte} placeholder="classe, trilha, origem, poder..." />
          </View>
          <TouchableOpacity style={styles.botao} onPress={adicionar}>
            <Text style={styles.botaoTexto}>Adicionar</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>

      {ficha.habilidades.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>Nenhuma habilidade cadastrada.</Text>
          </CardContent>
        </Card>
      ) : (
        ficha.habilidades.map((h) => (
          <Card key={h.id} style={styles.card}>
            <CardContent>
              <Text style={styles.itemNome}>{h.nome}</Text>
              <Text style={styles.itemMeta}>{h.fonte}{h.custo ? ' · custo ' + h.custo : ''}</Text>
              <Input
                label="Descrição"
                value={h.descricao}
                multiline
                onChangeText={(v) => atualizar({ habilidades: ficha.habilidades.map((x) => (x.id === h.id ? { ...x, descricao: v } : x)) })}
              />
              <TouchableOpacity onPress={() => remover(h.id)} style={styles.remover}>
                <Text style={styles.removerTexto}>Remover</Text>
              </TouchableOpacity>
            </CardContent>
          </Card>
        ))
      )}
    </ScrollView>
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
  card: { marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  stack: { gap: 10 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 10 },
  botaoTexto: { color: 'white', fontWeight: '600' },
  itemNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  itemMeta: { fontSize: 12, color: '#8888a0', marginTop: 4, marginBottom: 10 },
  remover: { marginTop: 10, padding: 8, alignItems: 'center' },
  removerTexto: { color: '#ef4444' },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
