export type BankOption = {
  code: string;
  name: string;
  aliases?: string[];
};

/** Instituições com código COMPE que recebem conta para repasse. */
export const BRAZILIAN_BANKS: BankOption[] = [
  { code: '246', name: 'Banco ABC Brasil' },
  { code: '075', name: 'Banco ABN Amro' },
  { code: '025', name: 'Banco Alfa' },
  { code: '065', name: 'Banco Andbank' },
  { code: '213', name: 'Banco Arbi' },
  { code: '024', name: 'Banco Bandepe' },
  { code: '330', name: 'Banco Bari' },
  { code: '318', name: 'Banco BMG' },
  { code: '107', name: 'Banco Bocom BBM' },
  { code: '063', name: 'Banco Bradescard' },
  { code: '122', name: 'Banco Bradesco BERJ' },
  { code: '394', name: 'Banco Bradesco Financiamentos' },
  { code: '237', name: 'Bradesco' },
  { code: '218', name: 'Banco BS2' },
  { code: '208', name: 'Banco BTG Pactual' },
  { code: '473', name: 'Banco Caixa Geral' },
  { code: '040', name: 'Banco Cargill' },
  { code: '739', name: 'Banco Cetelem' },
  { code: '233', name: 'Banco Cifra' },
  { code: '745', name: 'Citibank' },
  { code: '241', name: 'Banco Clássico' },
  { code: '403', name: 'Cora' },
  { code: '069', name: 'Banco Crefisa' },
  { code: '003', name: 'Banco da Amazônia' },
  { code: '083', name: 'Banco da China' },
  { code: '707', name: 'Banco Daycoval' },
  { code: '654', name: 'Banco Digimais' },
  { code: '335', name: 'Banco Digio' },
  { code: '001', name: 'Banco do Brasil' },
  { code: '004', name: 'Banco do Nordeste' },
  { code: '265', name: 'Banco Fator' },
  { code: '224', name: 'Banco Fibra' },
  { code: '094', name: 'Banco Finaxis' },
  { code: '125', name: 'Banco Genial' },
  { code: '612', name: 'Banco Guanabara' },
  { code: '012', name: 'Banco Inbursa' },
  { code: '604', name: 'Banco Industrial do Brasil' },
  { code: '077', name: 'Inter' },
  { code: '249', name: 'Banco Investcred' },
  { code: '184', name: 'Banco Itaú BBA' },
  { code: '479', name: 'Banco ItauBank' },
  { code: '074', name: 'Banco J. Safra' },
  { code: '376', name: 'Banco J.P. Morgan' },
  { code: '217', name: 'Banco John Deere' },
  { code: '076', name: 'Banco KDB' },
  { code: '757', name: 'Banco Keb Hana' },
  { code: '630', name: 'Banco Letsbank' },
  { code: '600', name: 'Banco Luso Brasileiro' },
  { code: '243', name: 'Banco Master' },
  { code: '389', name: 'Banco Mercantil do Brasil' },
  { code: '381', name: 'Banco Mercedes-Benz' },
  { code: '370', name: 'Banco Mizuho' },
  { code: '746', name: 'Banco Modal' },
  { code: '066', name: 'Banco Morgan Stanley' },
  { code: '456', name: 'Banco MUFG' },
  { code: '169', name: 'Banco Olé Bonsucesso' },
  { code: '212', name: 'Banco Original' },
  { code: '712', name: 'Banco Ourinvest' },
  { code: '623', name: 'Banco Pan' },
  { code: '611', name: 'Banco Paulista' },
  { code: '643', name: 'Banco Pine' },
  { code: '747', name: 'Banco Rabobank' },
  { code: '633', name: 'Banco Rendimento' },
  { code: '741', name: 'Banco Ribeirão Preto' },
  { code: '120', name: 'Banco Rodobens' },
  { code: '422', name: 'Banco Safra' },
  { code: '033', name: 'Santander' },
  { code: '743', name: 'Banco Semear' },
  { code: '754', name: 'Banco Sistema' },
  { code: '637', name: 'Banco Sofisa' },
  { code: '464', name: 'Banco Sumitomo Mitsui' },
  { code: '082', name: 'Banco Topázio' },
  { code: '634', name: 'Banco Triângulo' },
  { code: '653', name: 'Banco Voiter' },
  { code: '655', name: 'Banco BV' },
  { code: '610', name: 'Banco VR' },
  { code: '119', name: 'Banco Western Union' },
  { code: '124', name: 'Banco Woori' },
  { code: '348', name: 'Banco XP' },
  { code: '755', name: 'Bank of America' },
  { code: '021', name: 'Banestes' },
  { code: '041', name: 'Banrisul' },
  { code: '047', name: 'Banese' },
  { code: '037', name: 'Banpará' },
  { code: '070', name: 'BRB' },
  { code: '104', name: 'Caixa Econômica Federal' },
  { code: '336', name: 'C6 Bank' },
  { code: '085', name: 'Ailos' },
  { code: '121', name: 'Agibank' },
  { code: '461', name: 'Asaas' },
  { code: '133', name: 'Cresol' },
  { code: '450', name: 'FitBank' },
  { code: '364', name: 'Efí' },
  { code: '323', name: 'Mercado Pago' },
  { code: '536', name: 'Neon' },
  { code: '260', name: 'Nubank' },
  { code: '290', name: 'PagBank', aliases: ['PagBank (PagSeguro)', 'PagSeguro'] },
  { code: '380', name: 'PicPay' },
  { code: '301', name: 'Dock' },
  { code: '197', name: 'Stone' },
  { code: '084', name: 'Uniprime' },
  { code: '136', name: 'Unicred' },
  { code: '099', name: 'Uniprime Central' },
  { code: '748', name: 'Sicredi' },
  { code: '756', name: 'Sicoob' },
  { code: '280', name: 'Will Bank' },
].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function bankLabel(bank: BankOption) {
  return `${bank.code} · ${bank.name}`;
}

export function filterBanks(query: string) {
  const needle = fold(query);
  if (!needle) return BRAZILIAN_BANKS;
  return BRAZILIAN_BANKS.filter((bank) => fold(`${bank.code} ${bank.name}`).includes(needle));
}

export function matchBank(value: string) {
  const needle = fold(value);
  if (!needle) return null;
  return (
    BRAZILIAN_BANKS.find((bank) => {
      const names = [bank.name, ...(bank.aliases ?? [])].map(fold);
      return names.some((name) => name === needle);
    }) ?? null
  );
}
