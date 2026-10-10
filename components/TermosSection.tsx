import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Loader } from '@/components/Loader';
import { colors } from '@/constants/theme';
import { fetchEventBoletos } from '@/lib/boletos';
import { formatBRL } from '@/lib/format';
import { feeOnHundred, fetchProducerTerms, formatPercent, type ProducerTerms } from '@/lib/terms';

const CREDIT_PACKS = [
  ['50', 'R$ 25,00', 'R$ 0,50'],
  ['100', 'R$ 39,00', 'R$ 0,39'],
  ['200', 'R$ 76,00', 'R$ 0,38'],
  ['300', 'R$ 111,00', 'R$ 0,37'],
  ['400', 'R$ 144,00', 'R$ 0,36'],
  ['500', 'R$ 175,00', 'R$ 0,35'],
  ['600', 'R$ 204,00', 'R$ 0,34'],
  ['700', 'R$ 231,00', 'R$ 0,33'],
  ['800', 'R$ 256,00', 'R$ 0,32'],
  ['900', 'R$ 279,00', 'R$ 0,31'],
  ['1.000', 'R$ 300,00', 'R$ 0,30'],
] as const;

function DeliveryTerms() {
  return (
    <View style={styles.block}>
      <Text style={styles.title}>Termos de Uso e Condições Comerciais — Envio de Ingressos</Text>

      <View style={styles.section}>
        <Text style={styles.heading}>1. Serviço de Envio de Ingressos</Text>
        <Text style={styles.body}>
          Esta modalidade permite emitir e distribuir ingressos com QR Code a uma lista restrita de participantes, por
          inclusão manual ou importação de planilha. A cobrança da Gate8 é pela emissão dos ingressos, por meio de
          créditos adquiridos pelo produtor, e não por uma porcentagem sobre o valor do ingresso. Os termos de venda
          online e repasse de vendas das demais modalidades não se aplicam a este serviço.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>2. Pacotes e pagamento</Text>
        <Text style={styles.body}>
          Os créditos são adquiridos antecipadamente para o evento escolhido. O preço total do pacote é apresentado
          antes do pagamento. Atualmente, a compra é feita por Pix. Os créditos são liberados somente após a
          confirmação do pagamento.
        </Text>
        <Text style={styles.body}>
          A compra de créditos para o envio de ingressos deverá ser feita exclusivamente no site gate8.club, com o
          login do produtor.
        </Text>
        <Text style={styles.body}>Pacotes de créditos para emissão de ingressos</Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.tableHead]}>Ingressos</Text>
            <Text style={[styles.tableCell, styles.tableHead]}>Pacote</Text>
            <Text style={[styles.tableCell, styles.tableHead]}>Por ingresso</Text>
          </View>
          {CREDIT_PACKS.map(([tickets, pack, each]) => (
            <View key={tickets} style={styles.tableRow}>
              <Text style={styles.tableCell}>{tickets}</Text>
              <Text style={styles.tableCell}>{pack}</Text>
              <Text style={styles.tableCell}>{each}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>3. Consumo dos créditos</Text>
        <Text style={styles.body}>
          Cada ingresso emitido, com seu próprio QR Code, consome 1 crédito, inclusive quando um participante recebe
          mais de um ingresso. O consumo ocorre na emissão, não na abertura do convite nem na entrada no evento. O
          cancelamento de um ingresso já emitido não devolve o crédito consumido. Reenviar o mesmo ingresso não
          constitui uma nova emissão.
        </Text>
        <Text style={styles.body}>
          Quando o saldo for insuficiente para a quantidade solicitada, será necessário adquirir créditos adicionais
          antes de emitir os ingressos.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>4. Validade e liberação especial</Text>
        <Text style={styles.body}>
          Os créditos ficam vinculados exclusivamente ao evento para o qual foram adquiridos e podem ser utilizados até
          seu encerramento. Ao encerrar o evento, novas emissões são bloqueadas e o saldo restante perde a validade,
          sem transferência para outro evento.
        </Text>
        <Text style={styles.body}>
          Quando a administração da Gate8 conceder ao produtor a condição “Convites liberados”, não será exigida a
          compra de créditos para emitir ingressos enquanto essa condição estiver ativa. O encerramento do evento
          continua impedindo novas emissões.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>5. Envio e acompanhamento</Text>
        <Text style={styles.body}>
          O produtor é responsável pela conferência dos dados dos participantes, quantidades e endereços de e-mail
          antes da emissão e do envio. O status “Pendente” indica que os ingressos ainda não foram abertos;
          “Visualizado” registra a abertura do convite ou dos ingressos nos meios suportados. A visualização não
          comprova presença no evento, que depende da validação na portaria.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>6. Validação e internet no evento</Text>
        <Text style={styles.body}>
          A Gate8 disponibiliza a validação dos ingressos pela Portaria, por link ou aplicativo, sem cobrança adicional
          pela validação. A conexão com a internet e os dispositivos utilizados são de responsabilidade do produtor. A
          contratação de internet com a Gate8, quando necessária, depende de disponibilidade e orçamento separado.
          Esta modalidade não permite venda de ingressos pelas maquininhas da Gate8.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>7. Responsabilidade do produtor e dados pessoais</Text>
        <Text style={styles.body}>
          O produtor é responsável pela organização e realização do evento, informações fornecidas aos participantes,
          cumprimento da legislação aplicável, licenças e atendimento ao público. Também deve possuir autorização ou
          outra base legal adequada para cadastrar e compartilhar os dados dos participantes, observando a legislação
          de proteção de dados, e proteger os links e acessos de gerenciamento dos ingressos.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>8. Condições comerciais</Text>
        <Text style={styles.body}>
          Os preços e a quantidade de créditos de cada compra são os apresentados na confirmação do pacote. Eventuais
          alterações de preços aplicam-se a novas compras e não modificam a quantidade de créditos já adquirida. Estas
          condições não afastam os direitos assegurados pela legislação aplicável.
        </Text>
      </View>
    </View>
  );
}

export function TermosSection({
  eventId,
  nonce,
  mode = 'default',
}: {
  eventId?: string;
  nonce: number;
  mode?: 'default' | 'delivery';
}) {
  const [data, setData] = useState<ProducerTerms | null>(null);
  const [boletoEnabled, setBoletoEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (mode === 'delivery') {
      setBoletoEnabled(false);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [terms, boletos] = await Promise.all([
        fetchProducerTerms(eventId),
        eventId
          ? fetchEventBoletos(eventId).catch(() => null)
          : Promise.resolve(null),
      ]);
      setData(terms);
      setBoletoEnabled(Boolean(boletos?.enabled));
    } catch (caught) {
      setBoletoEnabled(false);
      if (!eventId) {
        setData({ pixPercent: 7.99, creditPercent: 7.99, sameRate: true });
        return;
      }
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar os termos.');
    } finally {
      setBusy(false);
    }
  }, [eventId, mode]);

  useEffect(() => {
    void load();
  }, [load, nonce]);

  if (mode === 'delivery') return <DeliveryTerms />;

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

      {boletoEnabled ? (
        <View style={styles.section}>
          <Text style={styles.heading}>Pagamento por boleto</Text>
          <Text style={styles.body}>
            Quando o pagamento por boleto estiver ativo, cada boleto efetivamente emitido custa R$ 3,49, mesmo
            enquanto estiver pendente. Essa taxa é descontada do produtor e não é acrescentada ao valor cobrado do
            comprador. O ingresso só é liberado depois da compensação de todos os boletos da compra. Até a
            compensação, o líquido do evento pode ficar negativo. O valor do boleto entra no repasse quando compensar,
            e não no momento da emissão.
          </Text>
        </View>
      ) : null}

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
  table: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tableCell: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tableHead: {
    color: colors.text,
    fontWeight: '700',
  },
  empty: {
    color: colors.muted,
    fontSize: 13,
  },
});
