import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useFicha } from '@/hooks/useFicha';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { generateId } from '@/lib/id';

const PRESETS = ['1d20', '1d100', '1d6', '2d6', '1d8', '1d10', '3d20'];

type Resultado = {
  id: string;
  formula: string;
  dados: number[];
  total: number;
  critico: boolean;
  falha: boolean;
};

function rolarFormula(formula: string): { dados: number[]; total: number; faces: number } | null {
  const m = /^(\d{1,2})d(\d{1,3})(?:\s*\+\s*(\d{1,3}))?$/.exec(formula.trim().toLowerCase());
  if (!m) return null;
  const qtd = Number(m[1]);
  const faces = Number(m[2]);
  const bonus = Number(m[3] ?? 0);
  if (!qtd || !faces || qtd > 50 || faces > 1000) return null;
  const dados: number[] = [];
  for (let i = 0; i < qtd; i += 1) {
    dados.push(1 + Math.floor(Math.random() * faces));
  }
  const total = dados.reduce((s, d) => s + d, 0) + bonus;
  return { dados, total, faces };
}

export default function RolagemScreen() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const { user } = useAuth();
  const campanha = campaignId ?? useAuth.getState().campaignId ?? 'default';
  const userId = user?.id ?? 'user-1';
  const { ficha } = useFicha(campanha, userId);

  const [formula, setFormula] = useState('1d20');
  const [historico, setHistorico] = useState<Resultado[]>([]);
  const [ultimo, setUltimo] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const rolar = useCallback(
    (f: string) => {
      const r = rolarFormula(f);
      if (!r) {
        setErro('Fórmula inválida. Use algo como 1d20, 2d6+3.');
        return;
      }
      setErro(null);
      const res: Resultado = {
        id: generateId(),
        formula: f,
        dados: r.dados,
        total: r.total,
        critico: r.dados.some((d) => d === r.faces),
        falha: r.dados.length === 1 && r.dados[0] === 1,
      };
      setUltimo(res);
      setHistorico((h) => [res, ...h].slice(0, 20));
    },
    []
  );

  const rolarPericia = (nome: string) => {
    const base = (ficha?.pericias[nome]?.treino || 0) + (ficha?.pericias[nome]?.extra || 0);
    const d20 = 1 + Math.floor(Math.random() * 20); // eslint-disable-line react-hooks/purity
    const res: Resultado = {
      id: generateId(),
      formula: nome + ' (1d20+' + String(base) + ')',
      dados: [d20],
      total: d20 + base,
      critico: d20 === 20,
      falha: d20 === 1,
    };
    setUltimo(res);
    setHistorico((h) => [res, ...h].slice(0, 20));
  };

  const pericias = ficha ? Object.keys(ficha.pericias) : [];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.titulo}>Rolagem de dados</Text>

      <Card style={styles.card}>
        <CardContent>
          <Input label="Fórmula" value={formula} onChangeText={setFormula} placeholder="1d20" />
          {erro ? <Text style={styles.erro}>{erro}</Text> : null}
          <View style={styles.presets}>
            {PRESETS.map((p) => (
              <TouchableOpacity key={p} onPress={() => setFormula(p)} style={styles.preset}>
                <Text style={styles.presetTexto}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.botao} onPress={() => rolar(formula)}>
            <Text style={styles.botaoTexto}>ROLAR</Text>
          </TouchableOpacity>
        </CardContent>
      </Card>

      {ultimo ? (
        <Card style={styles.card}>
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
      ) : null}

      {pericias.length > 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.secao}>Testes de perícia</Text>
            <View style={styles.pericias}>
              {pericias.map((p) => (
                <TouchableOpacity key={p} onPress={() => rolarPericia(p)} style={styles.pericia}>
                  <Text style={styles.periciaTexto}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </CardContent>
        </Card>
      ) : null}

      {historico.length > 0 ? (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.secao}>Histórico</Text>
            {historico.map((h) => (
              <View key={h.id} style={styles.linhaHistorico}>
                <Text style={styles.historicoFormula}>{h.formula}</Text>
                <Text style={styles.historicoTotal}>{h.total}</Text>
              </View>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 16 },
  card: { marginBottom: 12 },
  secao: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  preset: { backgroundColor: '#0f0f1a', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#2a2a3e' },
  presetTexto: { color: '#a0a0c0', fontSize: 13 },
  botao: { backgroundColor: '#3b82f6', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 16 },
  botaoTexto: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  resultadoFormula: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  resultadoTotal: { color: '#3b82f6', fontSize: 48, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 },
  resultadoDados: { color: '#8888a0', fontSize: 13, textAlign: 'center' },
  pericias: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pericia: { backgroundColor: '#0f0f1a', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#2a2a3e' },
  periciaTexto: { color: '#e8e8f0', fontSize: 13 },
  linhaHistorico: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#0f0f1a', borderRadius: 8, padding: 12, marginBottom: 8 },
  historicoFormula: { color: '#a0a0c0', fontSize: 13 },
  historicoTotal: { color: '#e8e8f0', fontSize: 15, fontWeight: '600' },
  erro: { color: '#ef4444', fontSize: 12, marginTop: 8 },
});
