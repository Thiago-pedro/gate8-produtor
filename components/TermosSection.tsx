import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { formatBRL } from '@/lib/format';
import { feeOnHundred, fetchProducerTerms, formatPercent, type ProducerTerms } from '@/lib/terms';

export function TermosSection({ eventId, nonce }: { eventId?: string; nonce: number }) {
  const [data, setData] = useState<ProducerTerms | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setData(await fetchProducerTerms(eventId));
    } catch (caught) {
      if (!eventId) {
        setData({ pixPercent: 7.99, creditPercent: 7.99, sameRate: true });
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os termos.');
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  if (busy && !data) {
    return (
      <View style={styles.boot}>
        <Loader size={148} />
      </View>
    );
  }

  if (error && !data) return <Text style={styles.empty}>{error}</Text>;
  if (!data) return null;

  const rate = data.sameRate
    ? formatPercent(data.pixPercent)
    : `${formatPercent(data.pixPercent)} no PIX e ${formatPercent(data.creditPercent)} no cartão de crédito`;

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Termos de Uso e Condições Comerciais — Gate8</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>1. Taxa de venda online</Text>
        {busy ? (
          <Text style={styles.body}>Consultando a tarifa atual do evento...</Text>
        ) : (
          <>
            <Text style={styles.body}>
              Na compra de cada ingresso, será cobrada uma taxa de serviço de {rate} sobre o valor do ingresso. Essa
              taxa é paga pelo comprador e será adicionada ao valor do ingresso no momento da compra. A tarifa é
              definida individualmente para cada evento no painel administrativo.
            </Text>
            <Text style={styles.body}>
              As compras no cartão de crédito poderão ser parceladas. Os juros incidentes sobre o parcelamento são de
              responsabilidade do cliente e não da Gate8.
            </Text>
            <Text style={styles.body}>Exemplo para um ingresso de R$ 100,00:</Text>
            <Text style={styles.bullet}>
              • PIX: {formatPercent(data.pixPercent)} = {formatBRL(feeOnHundred(data.pixPercent))} de taxa.
            </Text>
            <Text style={styles.bullet}>
              • Cartão de crédito: {formatPercent(data.creditPercent)} ={' '}
              {formatBRL(feeOnHundred(data.creditPercent))} de taxa.
            </Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>2. Validação de ingressos</Text>
        <Text style={styles.body}>
          A Gate8 fornece gratuitamente o sistema de validação de ingressos por meio de um link. A validação poderá ser
          realizada em qualquer celular com acesso à internet (Wi-Fi ou 4G/5G).
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>3. Internet no evento</Text>
        <Text style={styles.body}>
          A conexão com a internet é de responsabilidade do produtor. Caso necessite de internet para a validação dos
          ingressos durante o evento, o produtor poderá contratar esse serviço diretamente com a Gate8, mediante
          disponibilidade e orçamento.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>4. Venda física (PDV)</Text>
        <Text style={styles.body}>
          Caso o produtor utilize maquininhas da Gate8 para venda de ingressos durante o evento, será aplicada a taxa
          comercial previamente acordada entre as partes e, quando aplicável, o valor referente ao aluguel dos
          equipamentos.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>5. Financeiro</Text>
        <Text style={styles.body}>
          O produtor poderá acompanhar todas as vendas em tempo real por meio do menu Financeiro. O repasse dos valores
          será realizado em até 48 horas após o encerramento do evento, mediante transferência para a conta bancária
          cadastrada na Gate8.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>6. Repasse dos valores</Text>
        <Text style={styles.body}>
          Os repasses serão efetuados somente após a conclusão do evento, observados os prazos e condições comerciais
          vigentes, podendo ser retidos em caso de indícios de fraude, determinação judicial ou descumprimento destes
          termos.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>7. Responsabilidade do produtor</Text>
        <Text style={styles.body}>
          O produtor é integralmente responsável pelas informações publicadas, organização e realização do evento,
          cumprimento da legislação aplicável, obtenção das licenças necessárias e atendimento ao público.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>8. Alterações nas taxas e condições</Text>
        <Text style={styles.body}>
          A Gate8 poderá alterar suas taxas e condições comerciais mediante comunicação prévia aos produtores. As
          alterações não afetarão eventos já publicados, salvo acordo entre as partes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    marginTop: 18,
    gap: 14,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 14,
  },
  heading: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  bullet: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 20,
    marginLeft: 4,
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
  },
});
