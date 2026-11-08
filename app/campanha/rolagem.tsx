import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Vibration } from 'react-native';
import { useFicha } from '@/hooks/useFicha';
import { DiceDisplay } from '@/components/ui/DiceDisplay';
import { Ionicons } from '@expo/vector-icons';

type RolagemMode = 'teste' | 'ataque' | 'dano' | 'ritual' | 'iniciativa';

const MODES: { key: RolagemMode; label: string; icon: string; color: string }[] = [
  { key: 'teste', label: 'Teste', icon: 'cube', color: '#3b82f6' },
  { key: 'ataque', label: 'Ataque', icon: 'flash', color: '#ef4444' },
  { key: 'dano', label: 'Dano', icon: 'medical', color: '#f59e0b' },
  { key: 'ritual', label: 'Ritual', icon: 'flame', color: '#a855f7' },
  { key: 'iniciativa', label: 'Iniciativa', icon: 'timer', color: '#22c55e' },
];

const ATRIBUTOS = ['AGI', 'FOR', 'INT', 'PRE', 'VIG'];

export default function RolagemScreen() {
  const { campaignId } = React.useContext(require('expo-router').useLocalSearchParams());
  const { data: ficha, loading, error } = useFicha(campaignId || '', 'user-1');

  const [mode, setMode] = useState<RolagemMode>('teste');
  const [atributo, setAtributo] = useState<'AGI' | 'FOR' | 'INT' | 'PRE' | 'VIG'>('AGI');
  const [pericia, setPericia] = useState('');
  const [bonus, setBonus] = useState(0);
  const [dados, setDados] = useState('1d20');
  const [dificuldade, setDificuldade] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  if (loading) return <LoadingView />;
  if (error) return <ErrorView message={error} />;
  if (!ficha) return <EmptyView />;

  const periciasDisponiveis = Object.keys(ficha.sheet_data.pericias);

  const currentMode = MODES.find(m => m.key === mode)!;

  const rolar = useCallback(() => {
    const [quantidade, faces] = dados.split('d').map(Number);
    const rolls = Array.from({ length: quantidade }, () => Math.floor(Math.random() * faces) + 1);
    const totalDados = rolls.reduce((a, b) => a + b, 0);

    let total = totalDados;
    let periciaValor = 0;
    let atributoValor = 0;

    if (mode === 'teste' || mode === 'ataque' || mode === 'ritual' || mode === 'iniciativa') {
      periciaValor = ficha.sheet_data.pericias[pericia]?.treino || 0;
      periciaValor += ficha.sheet_data.pericias[pericia]?.extra || 0;
      atributoValor = ficha.sheet_data.atributos[atributo.toLowerCase() as keyof typeof ficha.sheet_data.atributos] || 0;
      total += periciaValor + atributoValor + bonus;
    } else if (mode === 'dano') {
      total += bonus;
    }

    const resultado = {
      mode,
      timestamp: Date.now(),
      dados: `${quantidade}d${faces}`,
      rolls,
      totalDados,
      pericia: pericia || '-',
      periciaValor,
      atributo: atributo,
      atributoValor,
      bonus,
      dificuldade: mode !== 'dano' ? dificuldade : 0,
      total,
      sucesso: mode !== 'dano' ? total >= dificuldade : null,
      critica: rolls.some(r => r === faces),
      falhaCritica: rolls.some(r => r === 1),
    };

    setLastResult(resultado);
    setHistory(prev => [resultado, ...prev.slice(0, 19)]);
    Vibration.vibrate(50);
  }, [mode, dados, pericia, atributo, bonus, dificuldade, ficha]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Rolagem de Dados</Text>

      <View style={styles.modeSelector}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.key}
            onPress={() => { setMode(m.key as RolagemMode); setLastResult(null); }}
            style={[styles.modeButton, mode === m.key && styles.modeButtonActive, { borderColor: m.color }]}
          >
            <Ionicons name={m.icon} size={20} color={mode === m.key ? m.color : '#8888a0'} />
            <Text style={[styles.modeButtonText, mode === m.key && { color: m.color }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.panel}>
        {mode === 'teste' && <TestePanel />}
        {mode === 'ataque' && <AtaquePanel />}
        {mode === 'dano' && <DanoPanel />}
        {mode === 'ritual' && <RitualPanel />}
        {mode === 'iniciativa' && <IniciativaPanel />}
      </View>

      <TouchableOpacity onPress={rolar} style={[styles.rollButton, { backgroundColor: currentMode.color }]} activeOpacity={0.9}>
        <Text style={styles.rollButtonText}>ROLAR</Text>
      </TouchableOpacity>

      {lastResult && <ResultCard result={lastResult} modeColor={currentMode.color} />}

      {history.length > 0 && (
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Histórico</Text>
          {history.map((r, i) => <HistoryItem key={i} result={r} />)}
        </View>
      )}
    </ScrollView>
  );

  function TestePanel() {
    return (
      <>
        <AttrPericiaSelect />
        <View style={styles.inputRow}>
          <Input label="Bônus" value={String(bonus)} onChange={v => setBonus(Number(v))} keyboardType="numeric" style={styles.smallInput} />
          <Input label="Dificuldade" value={String(dificuldade)} onChange={v => setDificuldade(Number(v))} keyboardType="numeric" style={styles.smallInput} />
        </View>
        <DadosInput />
      </>
    );
  }

  function AtaquePanel() {
    return (
      <>
        <AttrPericiaSelect />
        <View style={styles.inputRow}>
          <Input label="Bônus" value={String(bonus)} onChange={v => setBonus(Number(v))} keyboardType="numeric" style={styles.smallInput} />
          <Input label="Defesa Alvo" value={String(dificuldade)} onChange={v => setDificuldade(Number(v))} keyboardType="numeric" style={styles.smallInput} />
        </View>
        <DadosInput defaultDados="1d20" />
      </>
    );
  }

  function DanoPanel() {
    return (
      <>
        <View style={styles.inputRow}>
          <Input label="Bônus Dano" value={String(bonus)} onChange={v => setBonus(Number(v))} keyboardType="numeric" style={styles.smallInput} />
        </View>
        <DadosInput defaultDados="1d6" />
      </>
    );
  }

  function RitualPanel() {
    return (
      <>
        <AttrPericiaSelect />
        <View style={styles.inputRow}>
          <Input label="Custo PE" value={String(bonus)} onChange={v => setBonus(Number(v))} keyboardType="numeric" style={styles.smallInput} />
          <Input label="Dificuldade" value={String(dificuldade)} onChange={v => setDificuldade(Number(v))} keyboardType="numeric" style={styles.smallInput} />
        </View>
        <DadosInput defaultDados="1d20" />
      </>
    );
  }

  function IniciativaPanel() {
    return (
      <>
        <View style={styles.inputRow}>
          <Input label="Bônus" value={String(bonus)} onChange={v => setBonus(Number(v))} keyboardType="numeric" style={styles.smallInput} />
        </View>
        <DadosInput defaultDados="1d20" />
      </>
    );
  }

  function AttrPericiaSelect() {
    return (
      <View style={styles.attrPericiaRow}>
        <Select
          label="Atributo"
          value={atributo}
          options={ATRIBUTOS.map(a => ({ label: a, value: a }))}
          onChange={setAtributo}
          style={styles.halfWidth}
        />
        <Select
          label="Perícia"
          value={pericia}
          options={periciasDisponiveis.map(p => ({ label: p, value: p }))}
          onChange={setPericia}
          style={styles.halfWidth}
        />
      </View>
    );
  }

  function DadosInput({ defaultDados = '1d20' }: { defaultDados?: string }) {
    return (
      <View style={styles.dadosRow}>
        <Text style={styles.dadosLabel}>Dados:</Text>
        <Input value={dados} onChange={setDados} placeholder={defaultDados} style={styles.dadosInput} />
      </View>
    );
  }
}

function ResultCard({ result, modeColor }: { result: any; modeColor: string }) {
  const isSucesso = result.sucesso === true;
  const isFalha = result.sucesso === false;
  const isDano = result.sucesso === null;

  return (
    <View style={[styles.resultCard, { borderColor: modeColor }]}>
      <View style={styles.resultHeader}>
        <View style={styles.resultMain}>
          <DiceDisplay value={result.total} size="large" color={modeColor} />
          <View style={styles.resultInfo}>
            <Text style={[
              styles.resultStatus,
              isDano ? { color: modeColor } : isSucesso ? { color: '#22c55e' } : { color: '#ef4444' }
            ]}>
              {isDano ? 'Dano Total' : isSucesso ? 'SUCESSO' : 'FALHA'}
            </Text>
            <Text style={styles.resultDetail}>
              {result.dados} = [${result.rolls.join(', ')}] = {result.totalDados}
              {result.periciaValor > 0 && ` + ${result.pericia} (${result.periciaValor})`}
              {result.atributoValor > 0 && ` + ${result.atributo} (${result.atributoValor})`}
              {result.bonus !== 0 && ` ${result.bonus > 0 ? '+' : ''}${result.bonus}`}
              = <b>{result.total}</b>
            </Text>
            {result.dificuldade > 0 && !isDano && (
              <Text style={styles.resultDiff}>Dificuldade: {result.dificuldade}</Text>
            )}
          </View>
        </View>
        <View style={styles.resultBadges}>
          {result.critica && <Text style={[styles.badge, { backgroundColor: '#f59e0b' }]}>CRÍTICO!</Text>}
          {result.falhaCritica && <Text style={[styles.badge, { backgroundColor: '#ef4444' }]}>FALHA CRÍTICA!</Text>}
        </View>
      </View>
    </View>
  );
}

function HistoryItem({ result }: { result: any }) {
  const isSucesso = result.sucesso === true;
  const isFalha = result.sucesso === false;
  const isDano = result.sucesso === null;
  const time = new Date(result.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <View style={styles.historyItem}>
      <View style={styles.historyLeft}>
        <Text style={styles.historyTime}>{time}</Text>
        <Text style={[
          styles.historyMode,
          isDano ? { color: '#f59e0b' } : isSucesso ? { color: '#22c55e' } : { color: '#ef4444' }
        ]}>
          {result.mode.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.historyResult}>{result.dados} = {result.total}</Text>
    </View>
  );
}

function LoadingView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0' }}>Carregando...</Text></View>; }
function ErrorView({ message }: { message: string }) { return <View style={styles.centerContainer}><Text style={{ color: '#ef4444', textAlign: 'center' }}>{message}</Text></View>; }
function EmptyView() { return <View style={styles.centerContainer}><Text style={{ color: '#8888a0', textAlign: 'center' }}>Nenhuma ficha.</Text></View>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#e8e8f0', marginBottom: 16 },
  modeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#2a2a3e',
  },
  modeButtonActive: { backgroundColor: 'rgba(59,130,246,0.1)' },
  modeButtonText: { fontSize: 13, fontWeight: '600', color: '#aaaaaa' },
  panel: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 16 },
  inputRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  smallInput: { flex: 1 },
  attrPericiaRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  halfWidth: { flex: 1 },
  dadosRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  dadosLabel: { fontSize: 14, fontWeight: '500', color: '#aaaaaa', minWidth: 60 },
  dadosInput: { flex: 1, maxWidth: 120 },
  rollButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  rollButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  resultCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 2 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultMain: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  resultInfo: { flex: 1 },
  resultStatus: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  resultDetail: { fontSize: 12, color: '#8888a0', lineHeight: 18 },
  resultDiff: { fontSize: 12, color: '#f59e0b', marginTop: 4 },
  resultBadges: { flexDirection: 'row', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, color: 'white', fontSize: 11, fontWeight: 'bold' },
  historySection: { marginTop: 16 },
  historyTitle: { fontSize: 16, fontWeight: '600', color: '#e8e8f0', marginBottom: 12 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, marginBottom: 8 },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyTime: { fontSize: 11, color: '#8888a0' },
  historyMode: { fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  historyResult: { fontSize: 14, fontWeight: '600', color: '#e8e8f0' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
});