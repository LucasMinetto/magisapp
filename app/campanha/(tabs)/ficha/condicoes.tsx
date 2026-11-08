import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const CONDICOES = [
  'Sangrando', 'Envenenado', 'Queimando', 'Frio', 'Atordoado',
  'Caído', 'Agarrado', 'Imobilizado', 'Lento', 'Silenciado',
  'Cego', 'Surdo', 'Apavorado', 'Enlouquecendo', 'Inconsciente',
  'Morrendo', 'Morto',
];

export default function FichaCondicoesScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? user?.campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const { ficha, loading, error, saveFicha } = useFicha(campanha, userId);

  if (loading) return <Centered text="Carregando..." />;
  if (error) return <Centered text={error} error />;
  if (!ficha) return <Centered text="Nenhuma ficha nesta campanha ainda." />;

  const atualizar = (patch: Partial<NonNullable<typeof ficha>>) => {
    void saveFicha({ ...ficha, ...patch });
  };

  const tem = (c: string) => ficha.condicoes.includes(c);
  const alternar = (c: string) => {
    const novas = tem(c) ? ficha.condicoes.filter((x) => x !== c) : [...ficha.condicoes, c];
    atualizar({ condicoes: novas });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Condições ativas</Text>
          <View style={styles.chips}>
            {CONDICOES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => alternar(c)}
                style={[styles.chip, tem(c) ? styles.chipAtivo : null]}
              >
                <Text style={[styles.chipTexto, tem(c) ? styles.chipTextoAtivo : null]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Recursos</Text>
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Input label="PV atual" value={String(ficha.pvAtual)} keyboardType="numeric" onChangeText={(v) => atualizar({ pvAtual: Number(v) || 0 })} />
            </View>
            <View style={styles.cell}>
              <Input label="PE atual" value={String(ficha.peAtual)} keyboardType="numeric" onChangeText={(v) => atualizar({ peAtual: Number(v) || 0 })} />
            </View>
            <View style={styles.cell}>
              <Input label="SAN atual" value={String(ficha.sanAtual)} keyboardType="numeric" onChangeText={(v) => atualizar({ sanAtual: Number(v) || 0 })} />
            </View>
            <View style={styles.cell}>
              <Input label="PV temp." value={String(ficha.pvTemp)} keyboardType="numeric" onChangeText={(v) => atualizar({ pvTemp: Number(v) || 0 })} />
            </View>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Outras condições</Text>
          {ficha.condicoes.filter((c) => !CONDICOES.includes(c)).length === 0 ? (
            <Text style={styles.vazio}>Nenhuma condição personalizada.</Text>
          ) : (
            ficha.condicoes
              .filter((c) => !CONDICOES.includes(c))
              .map((c) => (
                <TouchableOpacity key={c} onPress={() => alternar(c)} style={styles.remover}>
                  <Text style={styles.removerTexto}>{c}  ✕</Text>
                </TouchableOpacity>
              ))
          )}
        </CardContent>
      </Card>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#0f0f1a', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#2a2a3e' },
  chipAtivo: { backgroundColor: '#ef4444', borderColor: '#ef4444' },
  chipTexto: { color: '#e8e8f0', fontSize: 13 },
  chipTextoAtivo: { color: 'white', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, minWidth: 96 },
  remover: { backgroundColor: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 8 },
  removerTexto: { color: '#ef4444' },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
