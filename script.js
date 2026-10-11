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
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
  try {
    const snap = await getDocs(query(collection(db, "horariosOcupados"), where("data", "==", dataString)));
    snap.forEach((docSnap) => {
      const item = docSnap.data();
      if (item.horario) ocupados.push(item.horario);
    });
  } catch (e) {
    console.error("Não foi possível verificar horários já reservados:", e);
  }
  return [...new Set([...bloqueadosManual, ...ocupados])];
}

// --- Calcular valor ---
function calcularValor(procedimentosTexto) {
  const mapaPrecos = {
    "Maquiagem Social": 150,
    "Curso | AutoMaquiagem": 300,
    "Brow Lamination": 120,
    "Brow Lamination + Henna": 135,
    "Baby Liss": 60,
    "Rabo Clássico": 80,
    "Semipreso Romântico": 90,
    "Semipreso com Tranças": 100,
    "Coque Express": 120,
    "Lash Lift": 120,
    "Design Personalizado": 35,
    "Design Personalizado + Tintura": 45,
    "Design Personalizado + Henna": 45,
    "Depilação de Buço": 15
  };

  let total = 0;

  const procedimentos = procedimentosTexto
    .split(",")
    .map(p =>
      p.replace(/^[^\p{L}\d]+/u, "")
        .split(" - ")[0]
        .trim()
    );

  for (const nome in mapaPrecos) {
    if (procedimentos.includes(nome)) {
      total += mapaPrecos[nome];
    }
  }

  return total;
}

// --- Fluxo ---
function askNext() {
  if (step < questions.length) {
    const question = questions[step];
    if (question === "Qual período prefere? (Manhã, Tarde, Noite)") showPeriods();
    else if (question === "Quais procedimentos deseja?") showProcedures();
    else if (question === "Escolha a data:") showCalendar();
    else if (question === "Qual a forma de pagamento? (PIX, Dinheiro, Cartão de Crédito, Cartão de Débito)") showReservaInfo(question);
    else botMessage(resolveTemplate(question));
  } else {
    atendimentoFinalizado = true;
    sendToWhatsAppAndFirestore();
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
    btn.onclick = () => {
      answers["Qual período prefere? (Manhã, Tarde, Noite)"] = period;
      userMessage(period);
      optionsDiv.remove();
      showPeriodHours(period);
      resetInactivityTimer();
    };
    optionsDiv.appendChild(btn);
  });
}

async function showPeriodHours(period) {
  botMessage(resolveTemplate(`Perfeito, {nome}! Agora escolha o horário (${period}): 🕒`));
  const optionsDiv = document.createElement('div');
  optionsDiv.id = 'optionsDiv';
  optionsDiv.innerText = "Carregando horários disponíveis...";
  chatMessages.appendChild(optionsDiv);

  const mapaPeriodo = { "Manhã": "manha", "Tarde": "tarde", "Noite": "noite" };
  const configPeriodo = dispoConfig.periodos[mapaPeriodo[period]];
  const start = configPeriodo.inicio;
  const end = configPeriodo.fim;

  const dataEscolhida = answers["Escolha a data:"];
  const horariosIndisponiveis = await getHorariosIndisponiveis(dataEscolhida);

  optionsDiv.innerText = "";

  for (let h = start; h <= end; h++) {
    const hour = `${String(h).padStart(2, '0')}:00`;
    const btn = document.createElement('button');
    btn.className = "chat-option-btn";
    btn.innerText = hour;

    if (horariosIndisponiveis.includes(hour)) {
      btn.disabled = true;
      btn.style.opacity = "0.4";
      btn.style.cursor = "not-allowed";
      btn.innerText = `${hour} (indisponível)`;
    } else {
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
}

// --- Taxa de reserva: resumo, regras e aceite ---
async function showReservaInfo(question) {
  userInput.style.display = 'none';
  sendBtn.style.display = 'none';
  const cfg = await pagamentoConfigPromise;
  const total = calcularValor(answers["Quais procedimentos deseja?"] || "");

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
    `• Taxa de reserva (${percentual}%): ${formatarReais(sinal)}\n` +
    `• Restante, pago no dia do atendimento: ${formatarReais(restante)}`
  ));

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

  const monthSelect = document.createElement('select');
  monthsAvailable.forEach(opt => {
    const option = document.createElement('option');
    option.value = JSON.stringify({ year: opt.year, month: opt.month });
    option.textContent = opt.name;
    monthSelect.appendChild(option);
  });
  container.appendChild(monthSelect);

  const daysDiv = document.createElement('div');
  daysDiv.id = 'calendarDays';
  daysDiv.style.marginTop = '10px';
  container.appendChild(daysDiv);

  function renderDays(year, month) {
    daysDiv.innerHTML = "";
    const lastDay = new Date(year, month + 1, 0).getDate();

    for (let i = 1; i <= lastDay; i++) {
      const btn = document.createElement('button');
      btn.className = "chat-option-btn";
      btn.innerText = i;

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

      if (isPastDay || diaSemanaDesativado || isBlockedDay) {
        btn.disabled = true;
        btn.style.opacity = "0.4";
        btn.style.cursor = "not-allowed";
      } else {
        btn.onclick = () => {
          const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
          answers["Escolha a data:"] = dateString;
          userMessage(dateString);
          container.remove();
          step++;
          askNext();
          resetInactivityTimer();
        };
      }

      daysDiv.appendChild(btn);
    }
  }

  // Exibir automaticamente o primeiro mês válido
  const firstMonth = JSON.parse(monthSelect.value);
  renderDays(firstMonth.year, firstMonth.month);

  // Troca de mês
  monthSelect.addEventListener("change", (e) => {
    const { year, month } = JSON.parse(e.target.value);
    renderDays(year, month);
  });
}

// --- Procedimentos ---
function showProcedures() {
  userInput.style.display = 'none';
  sendBtn.style.display = 'none';
  botMessage("💄 Agora me conta, quais procedimentos você gostaria de fazer? (pode escolher mais de um)");
  const procedures = [
    "💄 Maquiagem Social - R$ 150,00",
    "⚡ Curso | AutoMaquiagem - R$ 300,00",
    "🌿 Brow Lamination - R$ 120,00",
    "🌿 Brow Lamination + Henna - R$ 135,00",
    "✨ Baby Liss - R$ 60,00",
    "🌸 Semipreso Romântico - R$ 90,00",
    "🌺 Semipreso com Tranças - R$ 100,00",
    "👑 Coque Express - R$ 120,00",
    "🎀 Rabo Clássico - R$ 80,00",
    "👁️ Lash Lift - R$ 120,00",
    "✏️ Design Personalizado - R$ 35,00",
    "🎨 Design Personalizado + Tintura - R$ 45,00",
    "🌙 Depilação de Buço - R$ 15,00"
  ];

  const selected = [];
  const optionsDiv = document.createElement('div');
  chatMessages.appendChild(optionsDiv);

  procedures.forEach(proc => {
    const btn = document.createElement('button');
    btn.className = "chat-option-btn";
    btn.innerText = proc;
    btn.onclick = () => {
      if (!selected.includes(proc)) {
        selected.push(proc);
        btn.style.backgroundColor = "#00bcd4";
      } else {
        selected.splice(selected.indexOf(proc), 1);
        btn.style.backgroundColor = "#00e5ff";
      }
      resetInactivityTimer();
    };
    optionsDiv.appendChild(btn);
  });

  const doneBtn = document.createElement('button');
  doneBtn.className = "chat-option-btn";
  doneBtn.innerText = "Concluir";
  doneBtn.style.backgroundColor = "#556b2f";
  doneBtn.style.color = "white";
  doneBtn.onclick = () => {
    if (selected.length === 0) return;
    answers["Quais procedimentos deseja?"] = selected.join(", ");
    userMessage(selected.join(", "));
    optionsDiv.remove();
    step++;
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
    `📸 Instagram: ${answers[questions[2]]}\n` +
    `🎂 Aniversário: ${answers[questions[3]]}\n` +
    `📅 Data escolhida: ${answers["Escolha a data:"]}\n` +
    `🕒 Período: ${answers["Qual período prefere? (Manhã, Tarde, Noite)"]}\n` +
    `⏰ Horário: ${answers["Escolha o horário"]}\n` +
    `💄 Procedimentos desejados: ${answers["Quais procedimentos deseja?"]}\n` +
    (reserva ? "" : `💳 Forma de pagamento: ${answers[questions[7]]}\n`) +
    blocoReserva +
    `\nFico no aguardo da sua confirmação. Obrigado pelo carinho e atenção! ✨🥰`;

  const telefone = "554699401775";
  window.open(`https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`, '_blank');

  try {
    const dados = {
      nome: answers[questions[0]],
      telefone: formatarTelefone(answers[questions[1]]),
      instagram: answers[questions[2]],
      aniversario: answers[questions[3]],
      data: answers["Escolha a data:"],
      periodo: answers["Qual período prefere? (Manhã, Tarde, Noite)"],
      horario: answers["Escolha o horário"],
      procedimento: answers["Quais procedimentos deseja?"],
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

    await addDoc(collection(db, "agendamentos"), dados);

    console.log("✅ Agendamento salvo no Firestore!");

    // Registra também na coleção pública "horariosOcupados" (sem dados pessoais),
    // usada pelo próprio chat para saber quais horários já não estão mais livres.
    try {
      await addDoc(collection(db, "horariosOcupados"), {
        data: answers["Escolha a data:"],
        horario: answers["Escolha o horário"]
      });
    } catch (e2) {
      console.error("❌ Erro ao registrar horário ocupado:", e2);
    }

  } catch (e) {
    console.error("❌ Erro ao salvar no Firestore:", e);
  }
}

// --- Input manual ---
sendBtn.addEventListener('click', () => {
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

  userMessage(input);
  answers[questions[step]] = input.toLowerCase() === 'pular' ? 'Não informado' : input;
  userInput.value = '';
  step++;
  askNext();
  resetInactivityTimer();
});

// --- Inicializa ---
document.addEventListener("DOMContentLoaded", () => {
  botMessage(questions[0]);
  resetInactivityTimer();
});

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