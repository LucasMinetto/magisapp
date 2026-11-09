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

export default function FichaAtaquesScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? useAuth.getState().campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const { ficha, loading, error, saveFicha } = useFicha(campanha, userId);
  const [novo, setNovo] = useState('');

  if (loading) return <Centered text="Carregando..." />;
  if (error) return <Centered text={error} error />;
  if (!ficha) return <Centered text="Nenhuma ficha nesta campanha ainda." />;

  const atualizar = (patch: Partial<NonNullable<typeof ficha>>) => {
    void saveFicha({ ...ficha, ...patch });
  };

  const adicionar = () => {
    const nome = novo.trim();
    if (!nome) return;
    atualizar({
      ataques: [
        ...ficha.ataques,
        {
          id: novoId(),
          nome,
          pericia: 'Luta',
          bonusAtaque: 0,
          dano: '1d6',
          tipoDano: 'Impacto',
          danosExtras: [],
          arremesso: false,
          margemCritico: 20,
          multCritico: 2,
          alcance: 'Corpo a corpo',
          notas: '',
        },
      ],
    });
    setNovo('');
  };

  const remover = (id: string) => {
    atualizar({ ataques: ficha.ataques.filter((a) => a.id !== id) });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Adicionar ataque</Text>
          <Input label="Nome do ataque" value={novo} onChangeText={setNovo} placeholder="Ex.: Pistola .38" />
          <TouchableOpacity style={styles.botao} onPress={adicionar}>
            <Text style={styles.botaoTexto}>Adicionar</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>

      {ficha.ataques.length === 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>Nenhum ataque cadastrado.</Text>
          </CardContent>
        </Card>
      ) : (
        ficha.ataques.map((a) => (
          <Card key={a.id} style={styles.card}>
            <CardContent>
              <Text style={styles.itemNome}>{a.nome}</Text>
              <Text style={styles.itemMeta}>
                {a.pericia} · dano {a.dano} ({a.tipoDano}) · crítico {a.margemCritico}/x{a.multCritico} · {a.alcance}
              </Text>
              <View style={styles.grid}>
                <View style={styles.cell}>
                  <Input label="Bônus" value={String(a.bonusAtaque)} keyboardType="numeric" onChangeText={(v) => atualizar({ ataques: ficha.ataques.map((x) => (x.id === a.id ? { ...x, bonusAtaque: Number(v) || 0 } : x)) })} />
                </View>
                <View style={styles.cellWide}>
                  <Input label="Dano" value={a.dano} onChangeText={(v) => atualizar({ ataques: ficha.ataques.map((x) => (x.id === a.id ? { ...x, dano: v } : x)) })} />
                </View>
                <View style={styles.cellWide}>
                  <Input label="Alcance" value={a.alcance} onChangeText={(v) => atualizar({ ataques: ficha.ataques.map((x) => (x.id === a.id ? { ...x, alcance: v } : x)) })} />
                </View>
              </View>
              <TouchableOpacity onPress={() => remover(a.id)} style={styles.remover}>
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
  botao: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 10 },
  botaoTexto: { color: 'white', fontWeight: '600' },
  itemNome: { fontSize: 16, fontWeight: '600', color: '#e8e8f0' },
  itemMeta: { fontSize: 12, color: '#8888a0', marginTop: 4, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, minWidth: 72 },
  cellWide: { flexGrow: 2, minWidth: 110 },
  remover: { marginTop: 10, padding: 8, alignItems: 'center' },
  removerTexto: { color: '#ef4444' },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
