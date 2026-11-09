import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { useRolagens } from '@/hooks/useRolagens';
import { Card, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';

export default function AtaqueScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { ficha } = useFicha(campanha, userId);
  const { rolarAtaque, loading } = useRolagens(campanha, userId);

  const [ataqueIdx, setAtaqueIdx] = useState(0);
  const [ultimo, setUltimo] = useState<{ formula: string; total: number; dados: number[]; critico: boolean; falha: boolean } | null>(null);

  const ataques = ficha?.ataques ?? [];

  const handleRolar = async () => {
    if (!ataques.length) {
      Alert.alert('Erro', 'Nenhum ataque cadastrado na ficha');
      return;
    }

    const ataque = ataques[ataqueIdx];
    if (!ataque) return;

    try {
      const resultado = await rolarAtaque({
        bonusAtaque: ataque.bonusAtaque,
        dano: ataque.dano,
        tipoDano: ataque.tipoDano,
        margemCritico: ataque.margemCritico,
        multCritico: ataque.multCritico,
        rotulo: ataque.nome,
      });
      setUltimo({
        formula: resultado.formula,
        total: resultado.total,
        dados: resultado.dados,
        critico: resultado.critico,
        falha: resultado.falha,
      });
    } catch (e) {
      Alert.alert('Erro', (e as Error).message);
    }
  };

  if (!ataques.length) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.titulo}>Ataque</Text>
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>
              Nenhum ataque cadastrado na ficha.{' '}
              Adicione ataques na aba Ficha {' > '} Ataques.
            </Text>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Ataque</Text>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Selecione o ataque</Text>
          <Select
            value={String(ataqueIdx)}
            onChange={v => setAtaqueIdx(parseInt(v))}
            options={ataques.map((a, i) => ({ value: String(i), label: `${a.nome} (${a.dano} ${a.tipoDano})` }))}
            style={styles.select}
          />

          {ataques[ataqueIdx] && (
            <View style={styles.ataqueInfo}>
              <Text style={styles.infoLine}>Bônus: {ataques[ataqueIdx].bonusAtaque >= 0 ? '+' : ''}{ataques[ataqueIdx].bonusAtaque}</Text>
              <Text style={styles.infoLine}>Dano: {ataques[ataqueIdx].dano} {ataques[ataqueIdx].tipoDano}</Text>
              <Text style={styles.infoLine}>Crítico: {ataques[ataqueIdx].margemCritico}/x{ataques[ataqueIdx].multCritico}</Text>
              <Text style={styles.infoLine}>Alcance: {ataques[ataqueIdx].alcance || '-'}</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <TouchableOpacity style={[styles.botao, loading && styles.botaoDesativado]} onPress={handleRolar} disabled={loading}>
        <Text style={styles.botaoTexto}>{loading ? 'ROLANDO...' : 'ROLAR ATAQUE'}</Text>
      </TouchableOpacity>

      {ultimo && (
        <Card style={[styles.card, styles.resultadoCard]}>
          <CardContent>
            <Text style={styles.resultadoFormula}>{ultimo.formula}</Text>
            <Text style={styles.resultadoTotal}>{ultimo.total}</Text>
            <Text style={styles.resultadoDados}>
              [{ultimo.dados.join(', ')}]
              {ultimo.critico ? '  ✦ crítico!' : ''}
              {ultimo.falha ? '  ✕ falha crítica' : ''}
            </Text>
          </CardContent>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 16 },
  card: { marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  select: { marginBottom: 12 },
  ataqueInfo: { gap: 4, marginTop: 8, padding: 12, backgroundColor: '#1a1a2e', borderRadius: 8 },
  infoLine: { color: '#c8c8d8', fontSize: 13 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  resultadoCard: { backgroundColor: '#1a1a2e', borderColor: '#3b82f6', borderWidth: 1 },
  resultadoFormula: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  resultadoTotal: { color: '#3b82f6', fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 },
  resultadoDados: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  vazio: { color: '#8888a0', textAlign: 'center' },
});