import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

const ATRIBUTOS = ['agi', 'for', 'int', 'pre', 'vig'] as const;

export default function FichaAtributosScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? useAuth.getState().campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const { ficha, loading, error, saveFicha } = useFicha(campanha, userId);

  if (loading) return <Centered text="Carregando..." />;
  if (error) return <Centered text={error} error />;
  if (!ficha) return <Centered text="Nenhuma ficha nesta campanha ainda." />;

  const atualizar = (patch: Partial<NonNullable<typeof ficha>>) => {
    void saveFicha({ ...ficha, ...patch });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Identidade</Text>
          <View style={styles.stack}>
            <Input label="Jogador" value={ficha.jogador} onChangeText={(v) => atualizar({ jogador: v })} />
            <Input label="Classe" value={ficha.classe} onChangeText={(v) => atualizar({ classe: v })} />
            <Input label="Trilha" value={ficha.trilha} onChangeText={(v) => atualizar({ trilha: v })} />
            <Input label="Origem" value={ficha.origem} onChangeText={(v) => atualizar({ origem: v })} />
            <Input
              label="NEX (%)"
              value={String(ficha.nex)}
              keyboardType="numeric"
              onChangeText={(v) => atualizar({ nex: Number(v) || 0 })}
            />
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Atributos</Text>
          <View style={styles.grid}>
            {ATRIBUTOS.map((a) => (
              <View key={a} style={styles.cell}>
                <Input
                  label={a.toUpperCase()}
                  value={String(ficha.atributos[a])}
                  keyboardType="numeric"
                  onChangeText={(v) => atualizar({ atributos: { ...ficha.atributos, [a]: Number(v) || 0 } })}
                />
              </View>
            ))}
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Recursos atuais</Text>
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
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Bônus fixos</Text>
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Input label="PV" value={String(ficha.bonus.pv)} keyboardType="numeric" onChangeText={(v) => atualizar({ bonus: { ...ficha.bonus, pv: Number(v) || 0 } })} />
            </View>
            <View style={styles.cell}>
              <Input label="PE" value={String(ficha.bonus.pe)} keyboardType="numeric" onChangeText={(v) => atualizar({ bonus: { ...ficha.bonus, pe: Number(v) || 0 } })} />
            </View>
            <View style={styles.cell}>
              <Input label="SAN" value={String(ficha.bonus.san)} keyboardType="numeric" onChangeText={(v) => atualizar({ bonus: { ...ficha.bonus, san: Number(v) || 0 } })} />
            </View>
            <View style={styles.cell}>
              <Input label="Defesa eq." value={String(ficha.bonus.defesaEquip)} keyboardType="numeric" onChangeText={(v) => atualizar({ bonus: { ...ficha.bonus, defesaEquip: Number(v) || 0 } })} />
            </View>
            <View style={styles.cell}>
              <Input label="Defesa outros" value={String(ficha.bonus.defesaOutros)} keyboardType="numeric" onChangeText={(v) => atualizar({ bonus: { ...ficha.bonus, defesaOutros: Number(v) || 0 } })} />
            </View>
            <View style={styles.cell}>
              <Input label="Desloc. bônus" value={String(ficha.bonus.deslocamento)} keyboardType="numeric" onChangeText={(v) => atualizar({ bonus: { ...ficha.bonus, deslocamento: Number(v) || 0 } })} />
            </View>
          </View>
        </CardContent>
      </Card>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Perícias (treino / extra)</Text>
          {Object.keys(ficha.pericias).length === 0 ? (
            <Text style={styles.vazio}>Nenhuma perícia cadastrada.</Text>
          ) : (
            Object.entries(ficha.pericias).map(([nome, p]) => (
              <View key={nome} style={styles.periciaRow}>
                <Text style={styles.periciaNome}>{nome}</Text>
                <View style={styles.periciaInputs}>
                  <Input
                    value={String(p.treino)}
                    keyboardType="numeric"
                    style={styles.mini}
                    onChangeText={(v) => atualizar({ pericias: { ...ficha.pericias, [nome]: { ...p, treino: Number(v) || 0 } } })}
                  />
                  <Input
                    value={String(p.extra)}
                    keyboardType="numeric"
                    style={styles.mini}
                    onChangeText={(v) => atualizar({ pericias: { ...ficha.pericias, [nome]: { ...p, extra: Number(v) || 0 } } })}
                  />
                </View>
              </View>
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
  stack: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexGrow: 1, minWidth: 96 },
  periciaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f0f1a', borderRadius: 8, padding: 10, marginBottom: 8 },
  periciaNome: { fontSize: 14, color: '#e8e8f0', flex: 1 },
  periciaInputs: { flexDirection: 'row', gap: 6, width: 150 },
  mini: { minWidth: 68 },
  vazio: { color: '#8888a0' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centeredText: { color: '#8888a0', textAlign: 'center' },
  erro: { color: '#ef4444' },
});
