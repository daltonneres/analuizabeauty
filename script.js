// --- Vídeo em fullscreen ---
const video = document.getElementById("video-thumb");
const fullscreenBtn = document.getElementById("fullscreen-btn");

if (video && fullscreenBtn) {
  fullscreenBtn.addEventListener("click", () => {
    if (video.requestFullscreen) video.requestFullscreen();
    else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
    else if (video.msRequestFullscreen) video.msRequestFullscreen();
  });
}

// --- Bot de Atendimento ---
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

let step = 0;
const answers = {};
let clienteRecorrente = false;
let irParaCalendarioDepoisDosProcedimentos = false;

// Taxa de reserva (sinal) calculada para o agendamento em andamento
let reserva = null;
let atendimentoFinalizado = false;

const questions = [
  "👋 Olá, MARAVILHOSA! ✨💖\nSeja muito bem-vinda(o) ao autoatendimento da Ana Luiza Fernandes Makeup!\nPara começarmos, qual é o seu nome? 😊",
  "Perfeito, {nome}! Agora, poderia me informar seu número de telefone com DDD? 📞",
  "Que prazer falar com você, {nome}! 💕 Qual é o seu Instagram? (se preferir não informar, digite 'pular')",
  "Ah, {nome}, mais uma coisa 🎂 Qual é a sua data de aniversário? (dia/mês, ex: 15/03) Assim consigo te mandar um carinho especial no seu mês! Se preferir não informar, digite 'pular'.",
  "Escolha a data:",
  "Qual período prefere? (Manhã, Tarde, Noite)",
  "Quais procedimentos deseja?",
  "Qual a forma de pagamento? (PIX, Dinheiro, Cartão de Crédito, Cartão de Débito)"
];

// --- Personalização com o nome da cliente ---
function getPrimeiroNome() {
  const nome = (answers[questions[0]] || "").trim();
  if (!nome || nome.toLowerCase() === "não informado") return "querida";
  return nome.split(" ")[0];
}

function resolveTemplate(texto) {
  return texto.replace(/\{nome\}/g, getPrimeiroNome());
}

let inactivityTimer;
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  // Mais tempo na etapa de pagamento (a cliente precisa ler as regras e copiar o Pix)
  const ms = atendimentoFinalizado ? 600000 : (step >= 7 ? 180000 : 30000);
  inactivityTimer = setTimeout(() => {
    botMessage("⏳ Notei que você ficou um tempinho sem responder, então reiniciei nosso atendimento. Vamos começar de novo? 😊");
    chatMessages.innerHTML = "";
    step = 0;
    reserva = null;
    atendimentoFinalizado = false;
    clienteRecorrente = false;
    irParaCalendarioDepoisDosProcedimentos = false;
    for (let key in answers) delete answers[key];
    userInput.value = '';
    userInput.style.display = 'block';
    sendBtn.style.display = 'block';
    askNext();
  }, ms);
}

function botMessage(text) {
  const div = document.createElement('div');
  div.className = 'message bot';
  div.innerText = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function aguardarChat(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userMessage(text) {
  const div = document.createElement('div');
  div.className = 'message user';
  div.innerText = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Firebase Firestore ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { CATALOGO_PADRAO, criarIdCatalogo, formatarTempoMedio, calcularTempoMedio } from "./catalogo.js";

const firebaseConfig = {
  apiKey: "AIzaSyAlZAZjT8ZOWPf40Tf4lowdXcWxO179e1I",
  authDomain: "ana-makeup-bot.firebaseapp.com",
  projectId: "ana-makeup-bot",
  storageBucket: "ana-makeup-bot.firebasestorage.app",
  messagingSenderId: "448009074377",
  appId: "1:448009074377:web:fe1f01d20f35be123f7f18"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let catalogoServicos = CATALOGO_PADRAO.map((item) => ({ ...item, ativo: true }));
let precosServicos = Object.fromEntries(catalogoServicos.map((item) => [item.nome, item.valor]));
async function carregarPrecosServicos() {
  let usarCatalogoSalvo = false;
  try {
    const snap = await getDoc(doc(db, "configuracoes", "servicos"));
    if (snap.exists()) {
      const dados = snap.data();
      if (Array.isArray(dados.catalogo)) {
        usarCatalogoSalvo = true;
        catalogoServicos = dados.catalogo
          .filter((item) => item && typeof item.nome === "string")
          .map((item) => ({
            id: item.id || criarIdCatalogo(item.nome),
            nome: item.nome.trim(),
            descricao: typeof item.descricao === "string" ? item.descricao : "",
            valor: Number(item.valor ?? dados.precos?.[item.nome]) || 0,
            tempoMedioMinutos: Number(item.tempoMedioMinutos) || 0,
            tipo: ["servico", "produto", "combo"].includes(item.tipo) ? item.tipo : "servico",
            ativo: item.ativo !== false
          }));
      } else {
        const precosLegados = dados.precos || {};
        catalogoServicos = CATALOGO_PADRAO.map((item) => ({ ...item, valor: Number(precosLegados[item.nome] ?? item.valor), ativo: true }));
        Object.entries(precosLegados).forEach(([nome, valor]) => {
          if (!catalogoServicos.some((item) => item.nome === nome)) {
            catalogoServicos.push({ id: criarIdCatalogo(nome), nome, descricao: "", valor: Number(valor) || 0, tipo: "produto", ativo: true });
          }
        });
      }
    }
    precosServicos = Object.fromEntries(catalogoServicos.filter((item) => item.ativo !== false).map((item) => [item.nome, Number(item.valor) || 0]));
  } catch (e) {
    console.error("Não foi possível carregar os valores dos procedimentos; usando os valores padrão:", e);
  }
  const formatar = (valor) => `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.querySelectorAll(".servicos-grid .polaroid").forEach((card) => {
    const id = card.dataset.catalogId || criarIdCatalogo(card.querySelector("h3")?.textContent.trim());
    const item = catalogoServicos.find((servico) => servico.id === id);
    if (usarCatalogoSalvo && !item) {
      card.hidden = true;
      return;
    }
    if (!item) return;
    card.hidden = item.ativo === false;
    const titulo = card.querySelector("h3");
    if (titulo) titulo.textContent = item.nome;
    const imagem = card.querySelector("img");
    if (imagem) {
      imagem.alt = item.nome;
      imagem.title = item.nome;
    }
    const descricao = card.querySelector(".portfolio-desc p:not(.servico-preco)") || card.querySelector(":scope > p:not(.servico-preco)");
    if (descricao) descricao.textContent = item.descricao || "";
    const campo = card.querySelector(".servico-price-row strong");
    if (campo && item.valor !== undefined) campo.textContent = formatar(item.valor);
    let tempo = card.querySelector(".servico-duration-row");
    if (!tempo) {
      tempo = document.createElement("div");
      tempo.className = "servico-duration-row";
      (card.querySelector(".portfolio-desc") || card).appendChild(tempo);
    }
    if (item.tempoMedioMinutos > 0) {
      tempo.innerHTML = `<i class="fa-regular fa-clock" aria-hidden="true"></i><span>Tempo médio</span><strong>${formatarTempoMedio(item.tempoMedioMinutos)}</strong>`;
    } else tempo.remove();
  });
  const gradeServicos = document.querySelector(".servicos-grid");
  if (gradeServicos) {
    catalogoServicos.filter((item) => item.ativo !== false && !gradeServicos.querySelector(`[data-catalog-id="${CSS.escape(item.id)}"]`)).forEach((item) => {
      const card = document.createElement("article");
      card.className = "polaroid catalogo-servico-card visible";
      card.dataset.catalogId = item.id;
      const titulo = document.createElement("h3"); titulo.textContent = item.nome;
      const descricao = document.createElement("p"); descricao.textContent = item.descricao || "Conheça este item do nosso catálogo.";
      const valor = document.createElement("div"); valor.className = "servico-price-row";
      const rotuloValor = document.createElement("span"); rotuloValor.textContent = "Valor";
      const valorTexto = document.createElement("strong"); valorTexto.textContent = formatar(item.valor);
      valor.append(rotuloValor, valorTexto);
      const tempo = document.createElement("div"); tempo.className = "servico-duration-row";
      card.append(titulo, descricao, valor);
      if (item.tempoMedioMinutos > 0) {
        tempo.innerHTML = `<i class="fa-regular fa-clock" aria-hidden="true"></i><span>Tempo médio</span><strong>${formatarTempoMedio(item.tempoMedioMinutos)}</strong>`;
        card.appendChild(tempo);
      }
      gradeServicos.appendChild(card);
    });
  }
  return precosServicos;
}
const precosServicosPromise = carregarPrecosServicos();

// --- Disponibilidade (dias, horários e bloqueios definidos no painel) ---
let dispoConfig = {
  diasSemana: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
  periodos: {
    manha: { ativo: true, inicio: 5, fim: 11 },
    tarde: { ativo: true, inicio: 12, fim: 17 },
    noite: { ativo: true, inicio: 18, fim: 20 }
  },
  diasBloqueados: [],
  horariosBloqueados: {}
};

async function carregarDisponibilidade() {
  try {
    const snap = await getDoc(doc(db, "disponibilidade", "config"));
    if (snap.exists()) {
      const dados = snap.data();
      dispoConfig = {
        diasSemana: { ...dispoConfig.diasSemana, ...(dados.diasSemana || {}) },
        periodos: {
          manha: { ...dispoConfig.periodos.manha, ...(dados.periodos?.manha || {}) },
          tarde: { ...dispoConfig.periodos.tarde, ...(dados.periodos?.tarde || {}) },
          noite: { ...dispoConfig.periodos.noite, ...(dados.periodos?.noite || {}) }
        },
        diasBloqueados: dados.diasBloqueados || [],
        horariosBloqueados: dados.horariosBloqueados || {}
      };
    }
  } catch (e) {
    console.error("Não foi possível carregar a disponibilidade, usando padrão:", e);
  }
}
const dispoConfigPromise = carregarDisponibilidade();

// --- Configuração de pagamento (chave Pix, % da reserva e prazo — definidos no painel) ---
let pagamentoConfig = { tipoChave: "", chavePix: "", titular: "", percentualSinal: 50, prazoHoras: 12 };

async function carregarPagamentoConfig() {
  try {
    const snap = await getDoc(doc(db, "configuracoes", "pagamento"));
    if (snap.exists()) {
      const d = snap.data();
      pagamentoConfig = {
        tipoChave: d.tipoChave || "",
        chavePix: (d.chavePix || "").trim(),
        titular: d.titular || "",
        percentualSinal: Number(d.percentualSinal) > 0 ? Number(d.percentualSinal) : 50,
        prazoHoras: Number(d.prazoHoras) > 0 ? Number(d.prazoHoras) : 12
      };
    }
  } catch (e) {
    console.error("Não foi possível carregar a configuração de pagamento, usando padrão:", e);
  }
  return pagamentoConfig;
}
const pagamentoConfigPromise = carregarPagamentoConfig();

function formatarReais(n) {
  return "R$ " + Number(n || 0).toFixed(2).replace(".", ",");
}

function formatarPrazo(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} às ${hh}:${mi}`;
}

function copiarTexto(texto) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texto);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy") ? resolve() : reject(); } catch (err) { reject(err); }
    ta.remove();
  });
}

// Mostra a chave Pix no chat com botão de copiar
function mostrarChavePix() {
  const cfg = pagamentoConfig;
  const rotulo = cfg.tipoChave ? `Chave Pix (${cfg.tipoChave})` : "Chave Pix";
  botMessage(`🔑 ${rotulo}:\n${cfg.chavePix}` + (cfg.titular ? `\n👤 Titular: ${cfg.titular}` : ""));
  const wrap = document.createElement("div");
  wrap.id = "optionsDiv";
  const btn = document.createElement("button");
  btn.className = "chat-option-btn";
  btn.innerText = "📋 Copiar chave Pix";
  btn.onclick = async () => {
    try {
      await copiarTexto(cfg.chavePix);
      btn.innerText = "✅ Chave copiada!";
    } catch (e) {
      btn.innerText = "Copie manualmente a chave acima";
    }
    setTimeout(() => { btn.innerText = "📋 Copiar chave Pix"; }, 2500);
    resetInactivityTimer();
  };
  wrap.appendChild(btn);
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Retorna a lista de horários já reservados ou bloqueados numa data ---
async function getHorariosIndisponiveis(dataString) {
  if (!dataString) return [];
  const bloqueadosManual = dispoConfig.horariosBloqueados[dataString] || [];
  const ocupados = [];
  const snap = await getDocs(query(collection(db, "horariosOcupados"), where("data", "==", dataString)));
  snap.forEach((docSnap) => {
    const item = docSnap.data();
    if (item.horario) ocupados.push(item.horario);
  });
  return [...new Set([...bloqueadosManual, ...ocupados])];
}

// --- Calcular valor ---
function calcularValor(procedimentosTexto) {
  let total = 0;

  const procedimentos = String(procedimentosTexto || "")
    .split(",")
    .map(p =>
      p.replace(/^[^\p{L}\d]+/u, "")
        .split(" - ")[0]
        .trim()
    );

  for (const nome in precosServicos) {
    if (procedimentos.includes(nome)) {
      total += Number(precosServicos[nome]) || 0;
    }
  }

  return total;
}

// --- Fluxo ---
async function askNext() {
  if (step < questions.length) {
    if (step === 6 && answers[questions[6]]) { step++; return askNext(); }
    if (step === 7 && (answers[questions[7]] || reserva?.forma)) { step++; return askNext(); }
    const question = questions[step];
    if (question === "Qual período prefere? (Manhã, Tarde, Noite)") showPeriods();
    else if (question === "Quais procedimentos deseja?") showProcedures();
    else if (question === "Escolha a data:") showCalendar();
    else if (question === "Qual a forma de pagamento? (PIX, Dinheiro, Cartão de Crédito, Cartão de Débito)") showReservaInfo(question);
    else botMessage(resolveTemplate(question));
  } else {
    const resultado = await sendToWhatsAppAndFirestore();
    if (!resultado.ok) {
      atendimentoFinalizado = false;
      botMessage(resultado.ocupado
        ? "Esse horário acabou de ser reservado por outra cliente. Vou atualizar as opções para você escolher outro sem precisar recomeçar."
        : "Não consegui confirmar o agendamento agora. Sua preferência não foi perdida; tente salvar novamente em instantes.");
      if (resultado.ocupado) {
        delete answers["Escolha a data:"];
        delete answers["Qual período prefere? (Manhã, Tarde, Noite)"];
        delete answers["Escolha o horário"];
        step = 4;
        await aguardarChat(650);
        return askNext();
      }
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "chat-option-btn chat-waitlist-action";
      retry.textContent = "Tentar confirmar novamente";
      retry.onclick = () => askNext();
      chatMessages.appendChild(retry);
      return;
    }
    atendimentoFinalizado = true;
    if (reserva) {
      botMessage(resolveTemplate(
        `🎉 Prontinho, {nome}! Seu horário está pré-reservado por ${pagamentoConfig.prazoHoras} horas (até ${formatarPrazo(new Date(reserva.prazo))}), aguardando o pagamento da taxa de reserva de ${formatarReais(reserva.sinal)}.\n\n` +
        `📎 Envie o comprovante na conversa do WhatsApp que acabou de abrir. Assim que a Ana confirmar o pagamento, sua reserva fica garantida! 💕`
      ));
      if (reserva.forma === "PIX" && pagamentoConfig.chavePix) mostrarChavePix();
    } else {
      botMessage(resolveTemplate("🎉 Prontinho, {nome}! Recebi todas as suas informações. Te chamo no WhatsApp para confirmar tudo certinho. Até já! 💕"));
    }
  }
}

function chaveNomeCliente(nome) {
  return String(nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
}

function dataISOChat(valor) {
  const texto = String(valor || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function limparProcedimentoSalvo(texto) {
  const partes = String(texto || "").split(/,\s*(?=[^,]+-\s*R\$)/i);
  return partes.map((parte) => parte
    .replace(/^[^\p{L}\d]+/u, "")
    .replace(/\s+-\s+R\$.*$/i, "")
    .trim()
  ).filter(Boolean).join(", ") || String(texto || "").trim();
}

async function oferecerRepetirAtendimento() {
  try {
    const telefone = String(answers[questions[1]] || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
    const nomeKey = chaveNomeCliente(answers[questions[0]]);
    if (!/^\d{10,11}$/.test(telefone) || !nomeKey) return false;
    const registro = await getDoc(doc(db, "consultasCliente", `${telefone}_${nomeKey}`));
    if (!registro.exists()) return false;
    const hoje = new Date();
    const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const atendimentos = (registro.data().agendamentos || []).filter((ag) => !ag.canceladoCliente && ag.procedimento && dataISOChat(ag.data));
    if (!atendimentos.length) return false;
    atendimentos.sort((a, b) => dataISOChat(b.data).localeCompare(dataISOChat(a.data)));
    const ultimo = atendimentos.find((ag) => dataISOChat(ag.data) <= hojeISO) || atendimentos[0];
    const procedimentoAnterior = limparProcedimentoSalvo(ultimo.procedimento);
    const dataTexto = new Date(`${dataISOChat(ultimo.data)}T12:00:00`).toLocaleDateString("pt-BR");
    clienteRecorrente = true;
    answers[questions[2]] = "Não informado";
    answers[questions[3]] = "Não informado";
    userInput.style.display = "none";
    sendBtn.style.display = "none";
    const fraseAtendimento = dataISOChat(ultimo.data) < hojeISO ? "Seu último atendimento foi" : "Seu último agendamento está marcado";
    botMessage(`Que bom ter você de volta, ${getPrimeiroNome()}! 💕 ${fraseAtendimento} em ${dataTexto}, com ${procedimentoAnterior}. Gostaria de repetir esse procedimento?`);
    const opcoes = document.createElement("div");
    opcoes.className = "chat-horario-acoes chat-retorno-opcoes";
    const sim = document.createElement("button");
    sim.type = "button"; sim.className = "chat-option-btn"; sim.textContent = "Sim, quero repetir";
    const nao = document.createElement("button");
    nao.type = "button"; nao.className = "chat-option-btn chat-secondary-action"; nao.textContent = "Não, escolher outro serviço";
    sim.addEventListener("click", async () => {
      userMessage("Sim, quero repetir"); opcoes.remove();
      answers[questions[6]] = procedimentoAnterior;
      step = 4;
      await aguardarChat(350); askNext(); resetInactivityTimer();
    });
    nao.addEventListener("click", async () => {
      userMessage("Não, escolher outro serviço"); opcoes.remove();
      delete answers[questions[6]];
      irParaCalendarioDepoisDosProcedimentos = true;
      step = 6;
      await aguardarChat(350); askNext(); resetInactivityTimer();
    });
    opcoes.append(sim, nao); chatMessages.appendChild(opcoes); chatMessages.scrollTop = chatMessages.scrollHeight;
    return true;
  } catch (erro) {
    console.warn("Não foi possível consultar o histórico da cliente; seguindo o fluxo normal.", erro);
    return false;
  }
}

// --- Períodos ---
function showPeriods() {
  userInput.style.display = 'none';
  sendBtn.style.display = 'none';
  botMessage(resolveTemplate("Ótimo, {nome}! 😊 Qual período do dia fica melhor para você?"));
  const periodosAtivos = { "Manhã": "manha", "Tarde": "tarde", "Noite": "noite" };
  const periods = ["Manhã", "Tarde", "Noite"].filter(
    (p) => dispoConfig.periodos[periodosAtivos[p]].ativo !== false
  );
  const optionsDiv = document.createElement('div');
  optionsDiv.id = 'optionsDiv';
  chatMessages.appendChild(optionsDiv);

  periods.forEach(period => {
    const btn = document.createElement('button');
    btn.className = "chat-option-btn";
    btn.innerText = period;
    btn.onclick = async () => {
      answers["Qual período prefere? (Manhã, Tarde, Noite)"] = period;
      userMessage(period);
      optionsDiv.remove();
      await aguardarChat(450);
      showPeriodHours(period);
      resetInactivityTimer();
    };
    optionsDiv.appendChild(btn);
  });
}

async function showPeriodHours(period) {
  botMessage(resolveTemplate(`Perfeito, {nome}! Agora escolha o horário (${period}): 🕒`));
  await aguardarChat(450);
  const optionsDiv = document.createElement('div');
  optionsDiv.id = 'optionsDiv';
  optionsDiv.innerText = "Carregando horários disponíveis...";
  chatMessages.appendChild(optionsDiv);

  function anexarAlternativas() {
    const acoes = document.createElement("div");
    acoes.className = "chat-horario-acoes";
    const espera = document.createElement("button");
    espera.type = "button";
    espera.className = "chat-option-btn chat-waitlist-action";
    espera.textContent = "Não achei meu horário — deixar preferência";
    espera.onclick = () => abrirFormularioListaEspera(period);
    const outroPeriodo = document.createElement("button");
    outroPeriodo.type = "button";
    outroPeriodo.className = "chat-option-btn chat-secondary-action";
    outroPeriodo.textContent = "Ver outro período";
    outroPeriodo.onclick = async () => {
      optionsDiv.remove();
      await aguardarChat(350);
      showPeriods();
    };
    const outraData = document.createElement("button");
    outraData.type = "button";
    outraData.className = "chat-option-btn chat-secondary-action";
    outraData.textContent = "Escolher outra data";
    outraData.onclick = async () => {
      optionsDiv.remove();
      delete answers["Escolha a data:"];
      delete answers["Qual período prefere? (Manhã, Tarde, Noite)"];
      delete answers["Escolha o horário"];
      step = 4;
      await aguardarChat(350);
      showCalendar();
    };
    acoes.append(espera, outroPeriodo, outraData);
    optionsDiv.appendChild(acoes);
  }

  const mapaPeriodo = { "Manhã": "manha", "Tarde": "tarde", "Noite": "noite" };
  const configPeriodo = dispoConfig.periodos[mapaPeriodo[period]];
  const start = configPeriodo.inicio;
  const end = configPeriodo.fim;

  const dataEscolhida = answers["Escolha a data:"];
  let horariosIndisponiveis;
  try {
    horariosIndisponiveis = await getHorariosIndisponiveis(dataEscolhida);
  } catch (erro) {
    console.error("Não foi possível consultar os horários no banco:", erro);
    optionsDiv.innerText = "Não consegui consultar a agenda agora. Para evitar oferecer um horário já reservado, tente novamente em instantes ou deixe sua preferência.";
    const tentar = document.createElement("button");
    tentar.type = "button";
    tentar.className = "chat-option-btn chat-secondary-action";
    tentar.textContent = "Tentar consultar novamente";
    tentar.onclick = () => { optionsDiv.remove(); showPeriodHours(period); };
    optionsDiv.appendChild(tentar);
    anexarAlternativas();
    return;
  }

  optionsDiv.innerText = "";
  let quantidadeDisponivel = 0;
  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;

  for (let h = start; h <= end; h++) {
    const hour = `${String(h).padStart(2, '0')}:00`;
    const btn = document.createElement('button');
    btn.className = "chat-option-btn";
    btn.innerText = hour;
    const horarioPassado = dataEscolhida === hoje && h <= agora.getHours();

    if (horariosIndisponiveis.includes(hour) || horarioPassado) {
      btn.disabled = true;
      btn.style.opacity = "0.4";
      btn.style.cursor = "not-allowed";
      btn.innerText = `${hour} (indisponível)`;
    } else {
      quantidadeDisponivel++;
      btn.onclick = () => {
        answers["Escolha o horário"] = hour;
        userMessage(hour);
        optionsDiv.remove();
        step++;
        askNext();
        resetInactivityTimer();
      };
    }
    optionsDiv.appendChild(btn);
  }

  if (!quantidadeDisponivel) {
    const semVagas = document.createElement("p");
    semVagas.className = "chat-horario-vazio";
    semVagas.textContent = "Não há horários livres neste período para a data escolhida.";
    optionsDiv.prepend(semVagas);
  }
  anexarAlternativas();
}

function abrirFormularioListaEspera(periodo) {
  document.getElementById("listaEsperaForm")?.remove();
  botMessage("Claro! Você pode sugerir outra data ou horário e contar se precisa de algo personalizado. Vou deixar seu pedido para a Ana.");
  const form = document.createElement("form");
  form.id = "listaEsperaForm";
  form.className = "chat-waitlist-form";
  form.innerHTML = `
    <p>Deixe sua preferência. Data e horário são opcionais se você explicar o que precisa.</p>
    <label>Data preferida<input name="dataPreferida" type="date"></label>
    <label>Horário preferido<input name="horarioPreferido" type="time"></label>
    <label>Serviço ou combo desejado (opcional)<input name="procedimento" type="text" maxlength="300" placeholder="Ex.: maquiagem e penteado"></label>
    <label class="chat-waitlist-details">Pedido personalizado<textarea name="detalhes" rows="3" maxlength="500" placeholder="Ex.: preciso de atendimento fora dos horários mostrados ou tenho uma ocasião especial"></textarea></label>
    <button type="submit" class="chat-option-btn chat-waitlist-action">Enviar minha preferência</button>
    <button type="button" class="chat-option-btn chat-secondary-action" data-cancelar-espera>Voltar aos horários</button>
  `;
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const dateInput = form.querySelector('[name="dataPreferida"]');
  dateInput.min = hojeISO;
  dateInput.value = answers["Escolha a data:"] || "";
  form.addEventListener("input", resetInactivityTimer);
  form.querySelector('[data-cancelar-espera]').onclick = () => {
    form.remove();
    showPeriodHours(periodo);
  };
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dataPreferida = dateInput.value;
    const horarioPreferido = form.elements.horarioPreferido.value;
    const detalhes = form.elements.detalhes.value.trim();
    if (!dataPreferida && !horarioPreferido && !detalhes) {
      return alert("Informe uma data, um horário ou conte um pouco sobre o atendimento que você precisa.");
    }
    const botao = form.querySelector('[type="submit"]');
    botao.disabled = true;
    try {
      await addDoc(collection(db, "listaEspera"), {
        nome: answers[questions[0]] || "Cliente",
        telefone: formatarTelefone(answers[questions[1]] || ""),
        instagram: answers[questions[2]] || "",
        procedimento: form.elements.procedimento.value.trim() || answers["Quais procedimentos deseja?"] || "",
        dataPreferida,
        horarioPreferido,
        periodoPreferido: answers["Qual período prefere? (Manhã, Tarde, Noite)"] || periodo || "",
        detalhes,
        status: "aguardando",
        criadoEm: new Date().toISOString()
      });
      userMessage(`Preferência enviada${dataPreferida ? ` para ${dataPreferida.split("-").reverse().join("/")}` : ""}${horarioPreferido ? ` às ${horarioPreferido}` : ""}.`);
      form.remove();
      botMessage("Prontinho! Sua preferência foi enviada para a Ana. Ela vai verificar a agenda e falar com você pelo WhatsApp. 💕");
      atendimentoFinalizado = true;
      resetInactivityTimer();
    } catch (erro) {
      console.error("Não foi possível registrar a preferência na lista de espera:", erro);
      botMessage("Não consegui salvar sua preferência agora. Confira a conexão e tente enviar novamente.");
      botao.disabled = false;
    }
  });
  chatMessages.appendChild(form);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Taxa de reserva: resumo, regras e aceite ---
async function showReservaInfo(question) {
  userInput.style.display = 'none';
  sendBtn.style.display = 'none';
  const cfg = await pagamentoConfigPromise;
  const total = calcularValor(answers["Quais procedimentos deseja?"] || "");
  const tempoTotal = calcularTempoMedio(answers["Quais procedimentos deseja?"], catalogoServicos);

  // Se por algum motivo não foi possível calcular o valor, segue o fluxo antigo
  if (!(total > 0)) {
    reserva = null;
    showOptions(question);
    return;
  }

  const percentual = cfg.percentualSinal;
  const sinal = Math.round(total * percentual) / 100;
  const restante = Math.round((total - sinal) * 100) / 100;
  reserva = { total, percentual, sinal, restante, forma: null, prazo: null };

  botMessage(resolveTemplate(
    `💖 {nome}, para garantir a sua data e o seu horário, é cobrada uma taxa de reserva de ${percentual}% do valor dos serviços.\n\n` +
    `🧾 Resumo:\n` +
    `• Total dos serviços: ${formatarReais(total)}\n` +
    (tempoTotal > 0 ? `• Tempo médio estimado: ${formatarTempoMedio(tempoTotal)}\n` : "") +
    `• Taxa de reserva (${percentual}%): ${formatarReais(sinal)}\n` +
    `• Restante, pago no dia do atendimento: ${formatarReais(restante)}`
  ));

  // Separa o resumo das regras para que a cliente consiga ler cada mensagem.
  await aguardarChat(750);
  botMessage(
    `⚠️ Por favor, leia com atenção:\n\n` +
    `• A taxa de reserva não é reembolsável.\n` +
    `• Cancelamentos devem ser solicitados com no mínimo 7 dias úteis de antecedência.\n` +
    `• Para reagendar, entre em contato com no mínimo 20 minutos de antecedência do seu horário.\n` +
    `• Tolerância de atraso: 20 minutos. Passado esse tempo, não será possível realizar o atendimento no dia e será necessário remarcar.\n` +
    `• O pagamento da reserva deve ser feito em até ${cfg.prazoHoras} horas, com envio do comprovante.`
  );

  const optionsDiv = document.createElement('div');
  optionsDiv.id = 'optionsDiv';
  chatMessages.appendChild(optionsDiv);
  const btn = document.createElement('button');
  btn.className = "chat-option-btn";
  btn.innerText = "✅ Li e concordo";
  btn.onclick = () => {
    answers["Aceitou as regras da reserva"] = "Sim";
    userMessage("Li e concordo ✅");
    optionsDiv.remove();
    showOptions(question);
    resetInactivityTimer();
  };
  optionsDiv.appendChild(btn);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Opções de pagamento ---
function showOptions(question) {
  userInput.style.display = 'none';
  sendBtn.style.display = 'none';
  if (reserva) {
    botMessage(resolveTemplate(`Como você prefere pagar a taxa de reserva de ${formatarReais(reserva.sinal)}, {nome}? 💳`));
  } else if (question === questions[7]) {
    botMessage(resolveTemplate("Quase lá, {nome}! 💳 Qual será a forma de pagamento?"));
  } else {
    botMessage(resolveTemplate(question));
  }
  const optionsDiv = document.createElement('div');
  optionsDiv.id = 'optionsDiv';
  chatMessages.appendChild(optionsDiv);

  const options = reserva
    ? ["PIX", "Cartão de Crédito", "Cartão de Débito", "Outros"]
    : ["PIX", "Dinheiro", "Cartão de Crédito", "Cartão de Débito"];

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = "chat-option-btn";
    btn.innerText = opt;
    btn.onclick = () => {
      answers[question] = opt;
      userMessage(opt);
      optionsDiv.remove();
      if (reserva) {
        reserva.forma = opt;
        mostrarInstrucoesPagamento(opt);
      } else {
        step++;
        askNext();
      }
      resetInactivityTimer();
    };
    optionsDiv.appendChild(btn);
  });
}

// --- Instruções conforme a forma escolhida para pagar a reserva ---
async function mostrarInstrucoesPagamento(forma) {
  const cfg = await pagamentoConfigPromise;
  const horas = cfg.prazoHoras;

  if (forma === "PIX") {
    if (cfg.chavePix) {
      botMessage(resolveTemplate(`Perfeito, {nome}! Faça um Pix de ${formatarReais(reserva.sinal)} para a chave abaixo 👇`));
      mostrarChavePix();
      botMessage(`⏳ Você tem ${horas} horas para realizar o pagamento e enviar o comprovante pelo WhatsApp. Depois desse prazo, o horário poderá ser liberado para outra cliente.`);
    } else {
      botMessage(resolveTemplate(`Perfeito, {nome}! A Ana vai te enviar a chave Pix pelo WhatsApp.\n\n⏳ Você terá ${horas} horas para realizar o pagamento e enviar o comprovante.`));
    }
  } else if (forma === "Cartão de Crédito" || forma === "Cartão de Débito") {
    botMessage(resolveTemplate(`Combinado, {nome}! A Ana vai te enviar pelo WhatsApp as instruções para pagar a reserva no cartão.\n\n⏳ O prazo para o pagamento é de ${horas} horas.`));
  } else {
    botMessage(resolveTemplate(`Tudo bem, {nome}! Combine com a Ana pelo WhatsApp como prefere pagar a reserva.\n\n⏳ O prazo para o pagamento é de ${horas} horas.`));
  }

  const optionsDiv = document.createElement('div');
  optionsDiv.id = 'optionsDiv';
  chatMessages.appendChild(optionsDiv);
  const btn = document.createElement('button');
  btn.className = "chat-option-btn";
  btn.innerText = "✅ Finalizar e abrir WhatsApp";
  btn.onclick = () => {
    optionsDiv.remove();
    step++;
    askNext();
    resetInactivityTimer();
  };
  optionsDiv.appendChild(btn);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Calendário ---
async function showCalendar() {
  await dispoConfigPromise;
  userInput.style.display = 'none';
  sendBtn.style.display = 'none';
  botMessage(resolveTemplate('Show, {nome}! Agora vamos marcar a data! 📅 Escolha o mês e o dia:'));
  const container = document.createElement('div');
  container.id = 'calendarContainer';
  container.className = 'chat-calendar';
  const calendarIntro = document.createElement('p');
  calendarIntro.className = 'chat-calendar-intro';
  calendarIntro.textContent = 'Escolha um dia disponível para o seu atendimento.';
  container.appendChild(calendarIntro);
  chatMessages.appendChild(container);

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const currentDay = today.getDate();

  // --- Meses disponíveis: do mês atual até 12 meses à frente (atualiza sozinho) ---
  const nomesMeses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const monthsAvailable = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(currentYear, currentMonth + i, 1);
    monthsAvailable.push({
      name: `${nomesMeses[d.getMonth()]} ${d.getFullYear()}`,
      month: d.getMonth(),
      year: d.getFullYear()
    });
  }

  let monthIndex = 0;
  const header = document.createElement('div');
  header.className = 'chat-calendar-header';
  const previous = document.createElement('button');
  previous.type = 'button'; previous.className = 'chat-calendar-nav'; previous.setAttribute('aria-label', 'Mês anterior'); previous.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
  const monthTitle = document.createElement('h3'); monthTitle.className = 'chat-calendar-month';
  const next = document.createElement('button');
  next.type = 'button'; next.className = 'chat-calendar-nav'; next.setAttribute('aria-label', 'Próximo mês'); next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
  header.append(previous, monthTitle, next); container.appendChild(header);

  const weekdays = document.createElement('div');
  weekdays.className = 'chat-calendar-weekdays';
  ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach((dia) => {
    const label = document.createElement('span'); label.textContent = dia; weekdays.appendChild(label);
  });
  container.appendChild(weekdays);

  const daysDiv = document.createElement('div');
  daysDiv.id = 'calendarDays';
  daysDiv.className = 'chat-calendar-days';
  container.appendChild(daysDiv);
  const legend = document.createElement('div');
  legend.className = 'chat-calendar-legend';
  legend.innerHTML = '<span><i class="is-available"></i> Disponível</span><span><i class="is-today"></i> Hoje</span><span><i class="is-unavailable"></i> Indisponível</span>';
  container.appendChild(legend);

  function renderDays(year, month) {
    daysDiv.innerHTML = "";
    const lastDay = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    monthTitle.textContent = `${nomesMeses[month]} ${year}`;
    previous.disabled = monthIndex === 0;
    next.disabled = monthIndex === monthsAvailable.length - 1;
    for (let vazio = 0; vazio < firstWeekday; vazio++) {
      const spacer = document.createElement('span'); spacer.className = 'chat-calendar-spacer'; spacer.setAttribute('aria-hidden', 'true'); daysDiv.appendChild(spacer);
    }

    for (let i = 1; i <= lastDay; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = "chat-calendar-day";
      btn.innerText = i;
      btn.setAttribute('aria-label', `${i} de ${nomesMeses[month]} de ${year}`);

      // --- BLOQUEIO AUTOMÁTICO DE DIAS PASSADOS ---
      const isPastDay =
        year === currentYear &&
        month === currentMonth &&
        i < currentDay; // O dia de hoje fica disponível

      // --- Dia da semana desativado no painel administrativo ---
      const diaSemana = new Date(year, month, i).getDay();
      const diaSemanaDesativado = dispoConfig.diasSemana[diaSemana] === false;

      // --- Dia bloqueado manualmente no painel administrativo ---
      const dateStringDia = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const isBlockedDay = dispoConfig.diasBloqueados.includes(dateStringDia);

      if (year === currentYear && month === currentMonth && i === currentDay) btn.classList.add('is-today');
      if (isPastDay || diaSemanaDesativado || isBlockedDay) {
        btn.disabled = true;
        btn.classList.add('is-unavailable');
      } else {
        btn.onclick = () => {
          const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
          answers["Escolha a data:"] = dateString;
          const dataBonita = new Date(year, month, i).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
          userMessage(dataBonita.charAt(0).toUpperCase() + dataBonita.slice(1));
          container.remove();
          step++;
          askNext();
          resetInactivityTimer();
        };
      }

      daysDiv.appendChild(btn);
    }
  }

  const renderMesAtual = () => renderDays(monthsAvailable[monthIndex].year, monthsAvailable[monthIndex].month);
  previous.addEventListener('click', () => { if (monthIndex > 0) { monthIndex--; renderMesAtual(); } });
  next.addEventListener('click', () => { if (monthIndex < monthsAvailable.length - 1) { monthIndex++; renderMesAtual(); } });
  renderMesAtual();
}

// --- Procedimentos ---
async function showProcedures() {
  await precosServicosPromise;
  userInput.style.display = 'none';
  sendBtn.style.display = 'none';
  botMessage("💄 Agora me conta, quais procedimentos você gostaria de fazer? (pode escolher mais de um)");
  const iconesProcedimentos = {
    "Maquiagem Social": "💄", "Curso | AutoMaquiagem": "⚡", "Brow Lamination": "🌿",
    "Brow Lamination + Henna": "🌿", "Baby Liss": "✨", "Semipreso Romântico": "🌸",
    "Semipreso com Tranças": "🌺", "Coque Express": "👑", "Rabo Clássico": "🎀",
    "Lash Lift": "👁️", "Design Personalizado": "✏️", "Design Personalizado + Tintura": "🎨",
    "Design Personalizado + Henna": "🎨", "Depilação de Buço": "🌙"
  };
  const procedures = catalogoServicos.filter((item) => item.ativo !== false && Number(item.valor) >= 0);

  const selected = [];
  const optionsDiv = document.createElement('div');
  optionsDiv.className = "chat-procedure-options";
  chatMessages.appendChild(optionsDiv);

  procedures.forEach((item) => {
    const icone = iconesProcedimentos[item.nome] || (item.tipo === "combo" ? "✨" : item.tipo === "produto" ? "🛍️" : "💄");
    const proc = `${icone} ${item.nome} - ${formatarReais(item.valor)}`;
    const btn = document.createElement('button');
    btn.className = "chat-option-btn";
    btn.type = "button";
    const titulo = document.createElement("span");
    titulo.className = "chat-option-title";
    const categoria = item.tipo === "combo" ? "Combo · " : item.tipo === "produto" ? "Produto · " : "";
    titulo.textContent = `${icone} ${categoria}${item.nome} · ${formatarReais(item.valor)}`;
    btn.appendChild(titulo);
    if (item.tempoMedioMinutos > 0) {
      const tempo = document.createElement("small");
      tempo.className = "chat-option-duration";
      tempo.innerHTML = `<i class="fa-regular fa-clock" aria-hidden="true"></i> Tempo médio: ${formatarTempoMedio(item.tempoMedioMinutos)}`;
      btn.appendChild(tempo);
    }
    if (item.descricao) {
      const descricao = document.createElement("small");
      descricao.className = "chat-option-description";
      descricao.textContent = item.descricao;
      btn.appendChild(descricao);
    }
    btn.onclick = () => {
      if (!selected.includes(proc)) {
        selected.push(proc);
        btn.classList.add("selected");
        btn.setAttribute("aria-pressed", "true");
      } else {
        selected.splice(selected.indexOf(proc), 1);
        btn.classList.remove("selected");
        btn.setAttribute("aria-pressed", "false");
      }
      resetInactivityTimer();
    };
    optionsDiv.appendChild(btn);
  });

  const doneBtn = document.createElement('button');
  doneBtn.className = "chat-option-btn chat-finish-selection";
  doneBtn.innerText = "Concluir";
  doneBtn.onclick = () => {
    if (selected.length === 0) return;
    answers["Quais procedimentos deseja?"] = selected.join(", ");
    userMessage(selected.join(", "));
    optionsDiv.remove();
    if (clienteRecorrente && irParaCalendarioDepoisDosProcedimentos) {
      irParaCalendarioDepoisDosProcedimentos = false;
      step = 4;
    } else step++;
    askNext();
    resetInactivityTimer();
  };
  optionsDiv.appendChild(doneBtn);
}

function formatarTelefone(tel) {
  if (!tel) return "";

  // Remove tudo que não for número
  const numeros = tel.replace(/\D/g, "");

  // Remove o código do país (55), se existir
  const telefone = numeros.startsWith("55")
    ? numeros.slice(2)
    : numeros;

  // Deve ficar com DDD + número
  if (telefone.length < 10 || telefone.length > 11) {
    return tel; // ou return "";
  }

  const ddd = telefone.slice(0, 2);
  const numero = telefone.slice(2);

  if (numero.length === 9) {
    return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
  } else {
    return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  }
}

async function sendToWhatsAppAndFirestore() {
  const janelaWhatsApp = window.open("about:blank", "_blank");
  const cfg = pagamentoConfig;
  const prazoDate = reserva ? new Date(Date.now() + cfg.prazoHoras * 3600 * 1000) : null;
  if (reserva) reserva.prazo = prazoDate.toISOString();

  let blocoReserva = "";
  if (reserva) {
    blocoReserva =
      `\n💰 Total dos serviços: ${formatarReais(reserva.total)}\n` +
      `🔒 Taxa de reserva (${reserva.percentual}%): ${formatarReais(reserva.sinal)}\n` +
      `💳 Forma de pagamento da reserva: ${reserva.forma}\n` +
      (reserva.forma === "PIX" && cfg.chavePix ? `🔑 Chave Pix: ${cfg.chavePix}\n` : "") +
      `⏳ Prazo para pagamento: até ${formatarPrazo(prazoDate)}\n` +
      `📎 Vou enviar o comprovante por aqui.\n` +
      `✅ Li e concordo com as regras: reserva não reembolsável, cancelamento com no mínimo 7 dias úteis, reagendamento com no mínimo 20 minutos e tolerância de atraso de 20 minutos.\n`;
  }

  const mensagem =
    `Oi Ana! 💕 Tudo bem?\n` +
    `Acabei de fazer meu agendamento pelo autoatendimento do site e ficaria super feliz em confirmar com você! ✨\n\n` +
    `Aqui estão minhas informações:\n` +
    `👤 Nome: ${answers[questions[0]]}\n` +
    `📞 Telefone: ${formatarTelefone(answers[questions[1]])}\n` +
    (answers[questions[2]] && answers[questions[2]] !== "Não informado" ? `📸 Instagram: ${answers[questions[2]]}\n` : "") +
    (answers[questions[3]] && answers[questions[3]] !== "Não informado" ? `🎂 Aniversário: ${answers[questions[3]]}\n` : "") +
    `📅 Data escolhida: ${answers["Escolha a data:"]}\n` +
    `🕒 Período: ${answers["Qual período prefere? (Manhã, Tarde, Noite)"]}\n` +
    `⏰ Horário: ${answers["Escolha o horário"]}\n` +
    `💄 Procedimentos desejados: ${answers["Quais procedimentos deseja?"]}\n` +
    (calcularTempoMedio(answers["Quais procedimentos deseja?"], catalogoServicos) > 0 ? `⌛ Tempo médio estimado: ${formatarTempoMedio(calcularTempoMedio(answers["Quais procedimentos deseja?"], catalogoServicos))}\n` : "") +
    (reserva ? "" : `💳 Forma de pagamento: ${answers[questions[7]]}\n`) +
    blocoReserva +
    `\nFico no aguardo da sua confirmação. Obrigado pelo carinho e atenção! ✨🥰`;

  try {
    const dados = {
      nome: answers[questions[0]],
      telefone: formatarTelefone(answers[questions[1]]),
      telefoneBusca: String(answers[questions[1]] || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""),
      instagram: answers[questions[2]] || "Não informado",
      aniversario: answers[questions[3]] || "Não informado",
      data: answers["Escolha a data:"],
      periodo: answers["Qual período prefere? (Manhã, Tarde, Noite)"],
      horario: answers["Escolha o horário"],
      procedimento: answers["Quais procedimentos deseja?"],
      tempoMedioMinutos: calcularTempoMedio(answers["Quais procedimentos deseja?"], catalogoServicos),
      formaPagamento: answers["Qual a forma de pagamento? (PIX, Dinheiro, Cartão de Crédito, Cartão de Débito)"],
      valor: calcularValor(answers["Quais procedimentos deseja?"]) || 0,
      criadoEm: new Date().toISOString()
    };

    if (reserva) {
      Object.assign(dados, {
        sinalPercentual: reserva.percentual,
        sinalValor: reserva.sinal,
        sinalForma: reserva.forma,
        sinalStatus: "aguardando",
        sinalPrazo: reserva.prazo,
        aceitouRegras: true
      });
    }

    const dataEscolhida = answers["Escolha a data:"];
    const horarioEscolhido = answers["Escolha o horário"];
    const horariosIndisponiveis = await getHorariosIndisponiveis(dataEscolhida);
    if (horariosIndisponiveis.includes(horarioEscolhido)) {
      const erro = new Error("O horário já foi reservado.");
      erro.code = "HORARIO_OCUPADO";
      throw erro;
    }

    const chaveHorario = `reserva-${dataEscolhida}-${horarioEscolhido.replace(":", "-")}`;
    const ocupacaoRef = doc(db, "horariosOcupados", chaveHorario);
    const agendamentoRef = doc(collection(db, "agendamentos"));
    dados.slotId = chaveHorario;
    await runTransaction(db, async (transacao) => {
      const ocupacao = await transacao.get(ocupacaoRef);
      if (ocupacao.exists()) {
        const erro = new Error("O horário já foi reservado.");
        erro.code = "HORARIO_OCUPADO";
        throw erro;
      }
      transacao.set(ocupacaoRef, { data: dataEscolhida, horario: horarioEscolhido, agendamentoId: agendamentoRef.id });
      transacao.set(agendamentoRef, dados);
    });

    const telefone = "554699401775";
    if (janelaWhatsApp) janelaWhatsApp.location.href = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
    console.log("✅ Agendamento e horário salvos juntos no Firestore!");
    return { ok: true };

  } catch (e) {
    if (janelaWhatsApp) janelaWhatsApp.close();
    console.error("❌ Erro ao salvar no Firestore:", e);
    return { ok: false, ocupado: e.code === "HORARIO_OCUPADO" };
  }
}

// --- Input manual ---
sendBtn.addEventListener('click', async () => {
  const input = userInput.value.trim();

  if (!input) return;

  // --- VALIDAÇÃO EXCLUSIVA DO TELEFONE ---
  if (step === 1) {

    // Remove tudo que não for número
    const numeros = input.replace(/\D/g, "");

    // Remove o código do país (55), se existir
    const telefone = numeros.startsWith("55")
      ? numeros.slice(2)
      : numeros;

    // Aceita DDD + número (10 ou 11 dígitos)
    if (telefone.length !== 10 && telefone.length !== 11) {
      botMessage(
        "⚠️ Número inválido!\n\nVocê pode digitar:\n" +
        "• (46) 99999-9999\n" +
        "• 46 99999-9999\n" +
        "• 46999999999\n" +
        "• +55 46 99999-9999"
      );
      return;
    }
  }

  const respondendoTelefone = step === 1;
  userMessage(input);
  answers[questions[step]] = input.toLowerCase() === 'pular' ? 'Não informado' : input;
  userInput.value = '';
  step++;
  if (respondendoTelefone) {
    const reconhecida = await oferecerRepetirAtendimento();
    if (!reconhecida) {
      clienteRecorrente = false;
      askNext();
    }
    resetInactivityTimer();
    return;
  }
  askNext();
  resetInactivityTimer();
});

userInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  sendBtn.click();
});

// --- Inicializa ---
document.addEventListener("DOMContentLoaded", () => {
  botMessage(questions[0]);
  resetInactivityTimer();
});

// --- Área da cliente: consulta e gerenciamento de agendamentos ---
const clientAreaModal = document.getElementById("clientAreaModal");
let agendamentosCliente = [];
let identidadeCliente = null;
const abrirAreaCliente = () => {
  clientAreaModal.hidden = false;
  document.body.classList.add("client-area-open");
  document.querySelector('#clientLookupForm [name="nome"]').focus();
};
const fecharAreaCliente = () => {
  clientAreaModal.hidden = true;
  document.body.classList.remove("client-area-open");
};
document.querySelectorAll('a[href="#area-cliente"]').forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault(); abrirAreaCliente(); document.getElementById("main-nav")?.classList.remove("active");
}));
document.getElementById("clientAreaClose").addEventListener("click", fecharAreaCliente);
clientAreaModal.addEventListener("click", (event) => { if (event.target === clientAreaModal) fecharAreaCliente(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !clientAreaModal.hidden) fecharAreaCliente(); });
function alternarFormularioCliente(feedback) {
  document.getElementById("clientAppointmentsPanel").hidden = feedback;
  document.getElementById("clientFeedbackForm").hidden = !feedback;
  const abaAgenda = document.getElementById("clientAppointmentsTab");
  const abaFeedback = document.getElementById("clientFeedbackTab");
  abaAgenda.classList.toggle("is-active", !feedback); abaFeedback.classList.toggle("is-active", feedback);
  abaAgenda.setAttribute("aria-selected", String(!feedback)); abaFeedback.setAttribute("aria-selected", String(feedback));
}
document.getElementById("clientAppointmentsTab").addEventListener("click", () => alternarFormularioCliente(false));
document.getElementById("clientFeedbackTab").addEventListener("click", () => alternarFormularioCliente(true));
const statusConsulta = document.getElementById("clientLookupStatus");
const listaCliente = document.getElementById("clientAppointmentsList");
const inputNomeAreaCliente = document.querySelector('#clientLookupForm [name="nome"]');
const saudacaoAreaCliente = document.getElementById("clientGreetingName");
inputNomeAreaCliente.addEventListener("input", () => {
  const nome = inputNomeAreaCliente.value.trim();
  saudacaoAreaCliente.textContent = nome ? `${nome}, seja bem-vinda à sua área da cliente` : "seja bem-vinda";
});
const dataLocalISO = (valor) => {
  const s = String(valor || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const dataCliente = (valor) => { const iso = dataLocalISO(valor); return iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR") : valor || "Data não informada"; };
function antecedenciaDiasUteis(iso) {
  if (!iso) return 0;
  const [ano, mes, dia] = iso.split("-").map(Number);
  const fim = new Date(ano, mes - 1, dia); const cursor = new Date(); cursor.setHours(0,0,0,0);
  let dias = 0;
  while (cursor < fim) { cursor.setDate(cursor.getDate() + 1); if (cursor.getDay() !== 0 && cursor.getDay() !== 6) dias++; }
  return dias;
}
function renderizarAgendamentosCliente() {
  listaCliente.replaceChildren(); listaCliente.hidden = false;
  const toolbar = document.createElement("div"); toolbar.className = "client-list-toolbar";
  const titulo = document.createElement("p"); titulo.textContent = `${agendamentosCliente.length} atendimento(s) encontrado(s)`;
  const trocar = document.createElement("button"); trocar.type = "button"; trocar.className = "client-logout-button"; trocar.textContent = "Consultar outro telefone";
  trocar.addEventListener("click", () => { listaCliente.hidden = true; identidadeCliente = null; document.getElementById("clientLookupForm").reset(); document.querySelector('#clientLookupForm [name="nome"]').focus(); });
  toolbar.append(titulo, trocar); listaCliente.appendChild(toolbar);
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const ordenados = [...agendamentosCliente].sort((a,b) => (dataLocalISO(a.data)||"9999").localeCompare(dataLocalISO(b.data)||"9999"));
  if (!ordenados.length) { const vazio = document.createElement("div"); vazio.className = "client-empty-state"; vazio.textContent = "Não encontramos atendimentos com esses dados. Confira o nome e o telefone usados na reserva."; listaCliente.appendChild(vazio); return; }
  ordenados.forEach((ag) => {
    const card = document.createElement("article"); card.className = "client-appointment-card";
    const top = document.createElement("div"); top.className = "client-appointment-top";
    const dt = document.createElement("span"); dt.className = "client-appointment-date"; dt.textContent = `${dataCliente(ag.data)}${ag.horario ? ` · ${ag.horario}` : ""}`;
    const tag = document.createElement("span"); tag.className = "client-appointment-tag";
    const iso = dataLocalISO(ag.data); const passado = iso && new Date(`${iso}T00:00:00`) < hoje;
    tag.textContent = ag.canceladoCliente ? "Cancelado" : passado ? "Atendimento realizado" : "Próximo atendimento";
    top.append(dt,tag); card.appendChild(top);
    const detalhe = document.createElement("p"); detalhe.textContent = `${ag.procedimento || "Procedimento"}${ag.periodo ? ` · ${ag.periodo}` : ""}`; card.appendChild(detalhe);
    if (!passado && !ag.canceladoCliente) {
      const actions = document.createElement("div"); actions.className = "client-appointment-actions";
      const editar = document.createElement("button"); editar.type = "button"; editar.className = "client-secondary-button"; editar.textContent = "Pedir reagendamento";
      const cancelar = document.createElement("button"); cancelar.type = "button"; cancelar.className = "client-cancel-button"; cancelar.textContent = "Pedir cancelamento";
      const diasParaAtendimento = antecedenciaDiasUteis(iso);
      if (diasParaAtendimento < 7) { cancelar.disabled = true; cancelar.title = "Cancelamentos precisam ser feitos com 7 dias úteis de antecedência."; }
      const statusPedido = document.createElement("p"); statusPedido.className="client-status"; statusPedido.setAttribute("role","status");
      const form = document.createElement("form"); form.className = "client-reschedule-form"; form.hidden = true;
      const labelData = document.createElement("label"); labelData.textContent = "Data que você prefere";
      const inputData = document.createElement("input"); inputData.type = "date"; inputData.min = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10); inputData.required = true; labelData.appendChild(inputData);
      const labelHora = document.createElement("label"); labelHora.textContent = "Horário de preferência";
      const inputHora = document.createElement("input"); inputHora.type="time"; inputHora.required=true; labelHora.appendChild(inputHora);
      const msg = document.createElement("p"); msg.className="client-status client-full-width"; msg.setAttribute("role","status");
      const salvar = document.createElement("button"); salvar.type="submit"; salvar.className="client-primary-button client-full-width"; salvar.textContent="Enviar pedido para a Ana";
      const nota = document.createElement("p"); nota.className="client-access-note client-full-width"; nota.textContent="A alteração só será confirmada depois que a Ana verificar a disponibilidade e responder.";
      form.append(labelData,labelHora,nota,msg,salvar);
      editar.addEventListener("click", () => { form.hidden = !form.hidden; });
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault(); salvar.disabled=true; msg.textContent="Registrando seu pedido...";
        const janela=window.open("about:blank","_blank");
        try {
          const pedido={nome:identidadeCliente.nome,telefone:identidadeCliente.telefone,tipo:"reagendamento",dataAtual:String(ag.data||""),dataDesejada:inputData.value,horarioDesejado:inputHora.value,mensagem:`Pedido para o atendimento ${ag.procedimento||""} de ${dataCliente(ag.data)} às ${ag.horario||""}.`,status:"aguardando",criadoEm:new Date().toISOString()};
          await addDoc(collection(db,"solicitacoesCliente"),pedido);
          const texto=`Olá, Ana! Registrei um pedido de reagendamento pelo site.\n\nCliente: ${identidadeCliente.nome}\nTelefone: ${identidadeCliente.telefone}\nAtendimento atual: ${dataCliente(ag.data)} às ${ag.horario||""}\nNova preferência: ${dataCliente(inputData.value)} às ${inputHora.value}\n\nAguardo a confirmação da disponibilidade.`;
          const link=`https://wa.me/554699401775?text=${encodeURIComponent(texto)}`;
          if(janela) janela.location.href=link;
          msg.textContent="Pedido registrado. Envie a mensagem no WhatsApp para a Ana confirmar o novo horário.";
          if(!janela){const a=document.createElement("a");a.href=link;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Abrir WhatsApp";msg.append(" ",a);}
        } catch(e){janela?.close();console.error("Falha ao enviar pedido de reagendamento",e);msg.textContent="Não foi possível registrar o pedido. Tente novamente.";}
        finally{salvar.disabled=false;}
      });
      cancelar.addEventListener("click", async () => {
        if(!confirm("Deseja enviar um pedido de cancelamento para a Ana? O horário só será cancelado após a confirmação.")) return;
        cancelar.disabled=true; const janela=window.open("about:blank","_blank");
        try {
          const pedido={nome:identidadeCliente.nome,telefone:identidadeCliente.telefone,tipo:"cancelamento",dataAtual:String(ag.data||""),dataDesejada:"",horarioDesejado:"",mensagem:`Pedido de cancelamento do atendimento ${ag.procedimento||""} de ${dataCliente(ag.data)} às ${ag.horario||""}.`,status:"aguardando",criadoEm:new Date().toISOString()};
          await addDoc(collection(db,"solicitacoesCliente"),pedido);
          const texto=`Olá, Ana! Registrei um pedido de cancelamento pelo site.\n\nCliente: ${identidadeCliente.nome}\nTelefone: ${identidadeCliente.telefone}\nAtendimento: ${dataCliente(ag.data)} às ${ag.horario||""}\n\nPor favor, confirme o recebimento do pedido.`;
          const link=`https://wa.me/554699401775?text=${encodeURIComponent(texto)}`;
          if(janela) janela.location.href=link;
          if(!janela){statusPedido.textContent="Pedido registrado. ";const a=document.createElement("a");a.href=link;a.target="_blank";a.rel="noopener noreferrer";a.textContent="Abrir WhatsApp";statusPedido.appendChild(a);}
          else statusPedido.textContent="Pedido registrado e WhatsApp aberto para enviar à Ana.";
        } catch(e){janela?.close();console.error("Falha ao enviar pedido de cancelamento",e);statusPedido.textContent="Não foi possível registrar o pedido. Tente novamente.";cancelar.disabled=false;}
      });
      actions.append(editar,cancelar); card.append(actions,statusPedido,form);
      if (diasParaAtendimento < 7) { const aviso=document.createElement("p"); aviso.className="client-request-note"; aviso.textContent="Para cancelar, é necessário avisar com pelo menos 7 dias úteis de antecedência. Para outras opções, fale com a Ana."; card.appendChild(aviso); }
    }
    listaCliente.appendChild(card);
  });
}
async function atualizarConsultaCliente() {
  const nomeKey=identidadeCliente.nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100);
  const ref=doc(db,"consultasCliente",`${identidadeCliente.telefone}_${nomeKey}`);
  const resultado=await getDoc(ref);
  const nomeConsulta=identidadeCliente.nome.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
  const dados=resultado.exists()?resultado.data():{};
  agendamentosCliente=(dados.agendamentos||[]).filter((ag)=>String(ag.nomeBusca||"")===nomeConsulta);
  renderizarAgendamentosCliente();
}
document.getElementById("clientLookupForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const form=event.currentTarget; const fd=new FormData(form); const button=form.querySelector('button[type="submit"]');
  identidadeCliente={nome:String(fd.get("nome")||"").trim(),telefone:String(fd.get("telefone")||"").replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"")};
  saudacaoAreaCliente.textContent = `${identidadeCliente.nome}, seja bem-vinda à sua área da cliente`;
  if(identidadeCliente.telefone.length<10||identidadeCliente.telefone.length>11){statusConsulta.textContent="Informe um telefone com DDD válido.";return;}
  button.disabled=true;statusConsulta.textContent="Consultando seus atendimentos...";listaCliente.hidden=true;
  try{await atualizarConsultaCliente();statusConsulta.textContent="";}catch(e){console.error("Falha na consulta da área da cliente",e);statusConsulta.textContent="Não foi possível consultar agora. Tente novamente em instantes.";}
  finally{button.disabled=false;}
});

document.getElementById("clientFeedbackForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const dados = new FormData(form);
  const status = document.getElementById("clientFeedbackStatus");
  const botao = form.querySelector('button[type="submit"]');
  botao.disabled = true;
  status.textContent = "Enviando seu feedback...";
  try {
    await addDoc(collection(db, "feedbacks"), {
      nome: String(dados.get("nome") || "").trim(),
      dataAtendimento: String(dados.get("dataAtendimento") || ""),
      avaliacao: Number(dados.get("avaliacao")),
      mensagem: String(dados.get("mensagem") || "").trim(),
      publicado: false,
      status: "aguardando",
      criadoEm: new Date().toISOString()
    });
    status.textContent = "Obrigada pelo carinho! Seu feedback foi enviado para análise da Ana.";
    form.reset();
  } catch (erro) {
    console.error("Não foi possível salvar o feedback:", erro);
    status.textContent = "Não foi possível enviar agora. Confira a conexão e tente novamente.";
  } finally {
    botao.disabled = false;
  }
});

async function carregarDepoimentosAprovados() {
  const destino = document.getElementById("depoimentosAprovados");
  if (!destino) return;
  try {
    const snapshot = await getDocs(query(collection(db, "feedbacks"), where("publicado", "==", true)));
    destino.replaceChildren();
    snapshot.docs.slice(0, 6).forEach((item) => {
      const feedback = item.data();
      const card = document.createElement("article");
      card.className = "depoimento depoimento-aprovado";
      const estrelas = document.createElement("div");
      estrelas.className = "depoimento-estrelas";
      estrelas.setAttribute("aria-label", `Avaliação ${feedback.avaliacao} de 5`);
      estrelas.textContent = `${"★".repeat(Number(feedback.avaliacao) || 0)}${"☆".repeat(5 - (Number(feedback.avaliacao) || 0))}`;
      const mensagem = document.createElement("p");
      mensagem.textContent = `“${feedback.mensagem || ""}”`;
      const nome = document.createElement("span");
      nome.textContent = `— ${feedback.nome || "Cliente"}`;
      card.append(estrelas, mensagem, nome);
      destino.appendChild(card);
    });
    destino.hidden = snapshot.empty;
  } catch (erro) {
    console.error("Não foi possível carregar os depoimentos aprovados:", erro);
  }
}
carregarDepoimentosAprovados();

// POP-UP DE AVISO
document.addEventListener("DOMContentLoaded", () => {
  const popup = document.getElementById("popupAviso");
  const fechar = document.getElementById("fecharPopup");
  const entendi = document.getElementById("entendiPopup");

  // abre popup após 1 segundo
  setTimeout(() => {
    popup.classList.add("active");
  }, 1000);

  function fecharPopup() {
    popup.classList.remove("active");
  }

  fechar.addEventListener("click", fecharPopup);
  entendi.addEventListener("click", fecharPopup);

  // fechar clicando fora
  popup.addEventListener("click", (e) => {
    if (e.target === popup) {
      fecharPopup();
    }
  });
});
