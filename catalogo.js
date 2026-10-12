export const CATALOGO_PADRAO = [
  { id: "maquiagem-social", nome: "Maquiagem Social", descricao: "Ideal para festas e eventos, garantindo um visual elegante e duradouro.", valor: 150, tipo: "servico" },
  { id: "curso-automaquiagem", nome: "Curso | AutoMaquiagem", descricao: "Aprenda a criar sua própria maquiagem com técnicas simples, práticas e fáceis de reproduzir no dia a dia, valorizando sua beleza e sua autoestima.", valor: 300, tipo: "servico" },
  { id: "brow-lamination", nome: "Brow Lamination", descricao: "Alinhamento e fixação dos fios para sobrancelhas impecáveis.", valor: 120, tipo: "servico" },
  { id: "brow-lamination-henna", nome: "Brow Lamination + Henna", descricao: "Combinação perfeita para sobrancelhas definidas e com acabamento natural.", valor: 135, tipo: "servico" },
  { id: "baby-liss", nome: "Baby Liss", descricao: "Cachos definidos ou ondas naturais para um look moderno.", valor: 60, tipo: "servico" },
  { id: "semipreso-romantico", nome: "Semipreso Romântico", descricao: "Penteado delicado e elegante, perfeito para ocasiões especiais.", valor: 90, tipo: "servico" },
  { id: "semipreso-com-trancas", nome: "Semipreso com Tranças", descricao: "Um toque romântico e moderno para realçar seu visual.", valor: 100, tipo: "servico" },
  { id: "coque-express", nome: "Coque Express", descricao: "Praticidade e sofisticação em um penteado versátil e elegante.", valor: 120, tipo: "servico" },
  { id: "rabo-classico", nome: "Rabo Clássico", descricao: "Penteado atemporal que une charme e praticidade.", valor: 80, tipo: "servico" },
  { id: "lash-lift", nome: "Lash Lift", descricao: "Curvatura natural e duradoura para realçar ainda mais seu olhar.", valor: 120, tipo: "servico" },
  { id: "design-personalizado", nome: "Design Personalizado", descricao: "Beleza sob medida, com técnicas exclusivas para destacar seus traços únicos.", valor: 35, tipo: "servico" },
  { id: "design-personalizado-tintura", nome: "Design Personalizado + Tintura", descricao: "Beleza sob medida, com técnicas exclusivas para destacar seus traços únicos.", valor: 45, tipo: "servico" },
  { id: "design-personalizado-henna", nome: "Design Personalizado + Henna", descricao: "Definição, simetria e preenchimento natural com henna para realçar o formato das sobrancelhas e proporcionar um visual marcante e harmonioso.", valor: 45, tipo: "servico" },
  { id: "depilacao-de-buco", nome: "Depilação de Buço", descricao: "Remova os pelos indesejados do buço com cuidado e precisão. Nossa técnica garante conforto, praticidade e resultado imediato para realçar a beleza do seu rosto.", valor: 15, tipo: "servico" }
];

export function criarIdCatalogo(nome) {
  return String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function tempoMedioConfigurado(item) {
  return Number.isFinite(Number(item?.tempoMedioMinutos)) && Number(item.tempoMedioMinutos) > 0;
}

export function formatarTempoMedio(minutos) {
  const total = Math.round(Number(minutos));
  if (!Number.isFinite(total) || total <= 0) return "Tempo não informado";
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (!horas) return `${total} min`;
  if (!resto) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

export function calcularTempoMedio(procedimentosTexto, catalogo) {
  const texto = String(procedimentosTexto || "");
  return (catalogo || []).reduce((total, item) => (
    texto.includes(item.nome) ? total + (Number(item.tempoMedioMinutos) || 0) : total
  ), 0);
}
