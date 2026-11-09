import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { useRolagens } from '@/hooks/useRolagens';
import { Card, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';

export default function RitualScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { ficha } = useFicha(campanha, userId);
  const { rolarRitual, loading } = useRolagens(campanha, userId);

  const [ritualIdx, setRitualIdx] = useState(0);
  const [ultimo, setUltimo] = useState<{ formula: string; total: number; dados: number[]; critico: boolean; falha: boolean } | null>(null);

  const rituais = ficha?.rituais ?? [];

  const handleRolar = async () => {
    if (!rituais.length) {
      Alert.alert('Erro', 'Nenhum ritual cadastrado na ficha');
      return;
    }

    const ritual = rituais[ritualIdx];
    if (!ritual) return;

    // Bônus de Ocultismo
    const bonusOcultismo = (ficha?.pericias['Ocultismo']?.treino || 0) + (ficha?.pericias['Ocultismo']?.extra || 0);

    try {
      const resultado = await rolarRitual({
        bonusOcultismo,
        rotulo: ritual.nome,
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

  if (!rituais.length) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.titulo}>Ritual</Text>
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.vazio}>
              Nenhum ritual cadastrado na ficha.{' '}
              Adicione rituais na aba Ficha {' > '} Rituais.
            </Text>
          </CardContent>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Ritual</Text>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>Selecione o ritual</Text>
          <Select
            value={String(ritualIdx)}
            onChange={v => setRitualIdx(parseInt(v))}
            options={rituais.map((r, i) => ({ value: String(i), label: `${r.nome} (${r.elemento}, ${r.circulo}º círculo)` }))}
            style={styles.select}
          />

          {rituais[ritualIdx] && (
            <View style={styles.ritualInfo}>
              <Text style={styles.infoLine}>Elemento: {rituais[ritualIdx].elemento}</Text>
              <Text style={styles.infoLine}>Círculo: {rituais[ritualIdx].circulo}º</Text>
              <Text style={styles.infoLine}>Execução: {rituais[ritualIdx].execucao || '-'}</Text>
              <Text style={styles.infoLine}>Alcance: {rituais[ritualIdx].alcance || '-'}</Text>
              <Text style={styles.infoLine}>Duração: {rituais[ritualIdx].duracao || '-'}</Text>
              <Text style={styles.infoLine}>Resistência: {rituais[ritualIdx].resistencia || 'Nenhuma'}</Text>
              {rituais[ritualIdx].danoNormal && (
                <Text style={styles.infoLine}>Dano: {rituais[ritualIdx].danoNormal} {rituais[ritualIdx].tipoDano || ''}</Text>
              )}
              <Text style={[styles.infoLine, styles.efeito]}>Efeito: {rituais[ritualIdx].efeito || '-'}</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <TouchableOpacity style={[styles.botao, loading && styles.botaoDesativado]} onPress={handleRolar} disabled={loading}>
        <Text style={styles.botaoTexto}>{loading ? 'ROLANDO...' : 'ROLAR RITUAL'}</Text>
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
  ritualInfo: { gap: 4, marginTop: 8, padding: 12, backgroundColor: '#1a1a2e', borderRadius: 8 },
  infoLine: { color: '#c8c8d8', fontSize: 13 },
  efeito: { marginTop: 8 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  resultadoCard: { backgroundColor: '#1a1a2e', borderColor: '#3b82f6', borderWidth: 1 },
  resultadoFormula: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  resultadoTotal: { color: '#3b82f6', fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 },
  resultadoDados: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  vazio: { color: '#8888a0', textAlign: 'center' },
});