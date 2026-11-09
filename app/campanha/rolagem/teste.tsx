import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { useRolagens } from '@/hooks/useRolagens';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Ionicons } from '@expo/vector-icons';

const ATRIBUTOS = ['agi', 'for', 'int', 'pre', 'vig'] as const;
type Atributo = (typeof ATRIBUTOS)[number];

const ATRIBUTO_LABELS: Record<Atributo, string> = {
  agi: 'Agilidade (AGI)',
  for: 'Força (FOR)',
  int: 'Intelecto (INT)',
  pre: 'Presença (PRE)',
  vig: 'Vigor (VIG)',
};

export default function TesteScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? (useAuth.getState().campaignId ?? 'default');
  const userId = user?.id ?? 'user-1';
  const { ficha } = useFicha(campanha, userId);
  const { rolarTeste, loading } = useRolagens(campanha, userId);

  const [atributo, setAtributo] = useState<Atributo>('agi');
  const [pericia, setPericia] = useState<string>('');
  const [dadosExtras, setDadosExtras] = useState(0);
  const [ultimo, setUltimo] = useState<{ formula: string; total: number; dados: number[]; critico: boolean; falha: boolean } | null>(null);

  const handleRolar = async () => {
    if (!ficha) {
      Alert.alert('Erro', 'Ficha não carregada');
      return;
    }

    let bonus = 0;
    let rotulo = '';

    if (pericia) {
      bonus = (ficha.pericias[pericia]?.treino || 0) + (ficha.pericias[pericia]?.extra || 0);
      rotulo = pericia;
    } else {
      bonus = 0;
      rotulo = ATRIBUTO_LABELS[atributo];
    }

    const valorAtributo = ficha.atributos[atributo];

    try {
      const resultado = await rolarTeste({
        atributo,
        valorAtributo,
        bonus,
        dadosExtras,
        rotulo,
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

  const periciasDisponiveis = ficha ? Object.keys(ficha.pericias) : [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Teste de Perícia/Atributo</Text>

      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.secao}>1. Escolha atributo ou perícia</Text>

          <Select
            label="Atributo base"
            value={atributo}
            onChange={v => setAtributo(v as Atributo)}
            options={ATRIBUTOS.map(a => ({ value: a, label: ATRIBUTO_LABELS[a] }))}
            style={styles.select}
          />

          {periciasDisponiveis.length > 0 && (
            <Select
              label="Perícia (opcional)"
              value={pericia}
              onChange={setPericia}
              options={[{ value: '', label: 'Nenhuma (apenas atributo)' }, ...periciasDisponiveis.map(p => ({ value: p, label: p }))]}
              style={styles.select}
            />
          )}

          <View style={styles.inputRow}>
            <Input
              label="Dados extras (±)"
              value={String(dadosExtras)}
              onChangeText={v => setDadosExtras(parseInt(v) || 0)}
              keyboardType="numeric"
              style={styles.inputHalf}
            />
          </View>
        </CardContent>
      </Card>

      <TouchableOpacity style={[styles.botao, loading && styles.botaoDesativado]} onPress={handleRolar} disabled={loading}>
        <Text style={styles.botaoTexto}>{loading ? 'ROLANDO...' : 'ROLAR TESTE'}</Text>
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
  inputRow: { flexDirection: 'row', gap: 12 },
  inputHalf: { flex: 1 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  botaoDesativado: { opacity: 0.6 },
  botaoTexto: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  resultadoCard: { backgroundColor: '#1a1a2e', borderColor: '#3b82f6', borderWidth: 1 },
  resultadoFormula: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  resultadoTotal: { color: '#3b82f6', fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 },
  resultadoDados: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
});