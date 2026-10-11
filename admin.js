// --- Firebase --- //
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  arrayUnion,
  arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
const auth = getAuth(app);

// --- Elementos --- //
const loginContainer = document.getElementById("loginContainer");
const adminContainer = document.getElementById("adminContainer");
const usuarioInput = document.getElementById("usuario");
const senhaInput = document.getElementById("senha");
const btnLogin = document.getElementById("btnLogin");
const erroLogin = document.getElementById("erroLogin");
const btnLogout = document.getElementById("btnLogout");
const tabelaAgendamentos = document.getElementById("tabelaAgendamentos");
const totalAgendamentos = document.getElementById("totalAgendamentos");
const valorTotal = document.getElementById("valorTotal");
const pagamentosResumo = document.getElementById("pagamentosResumo");
const btnExportar = document.getElementById("btnExportar");
const btnApagarMes = document.getElementById("btnApagarMes");
const btnNovoAtendimento = document.getElementById("btnNovoAtendimento");

// --- Despesas: elementos --- //
const tabelaDespesas = document.getElementById("tabelaDespesas");
const valorDespesasEl = document.getElementById("valorDespesas");
const valorLiquidoEl = document.getElementById("valorLiquido");
const btnNovaDespesa = document.getElementById("btnNovaDespesa");
const modalDespesa = document.getElementById("modalDespesa");
const fecharModalDespesa = document.getElementById("fecharModalDespesa");
const salvarDespesaBtn = document.getElementById("salvarDespesa");

// Totais globais usados para calcular o valor líquido (bruto - despesas)
let totalBrutoGlobal = 0;
let totalDespesasGlobal = 0;

// Estado do filtro de mês: "todos" por padrão (antes controlado pela opção
// "Todos os Meses" dentro do <select>, agora controlado pelo botão dedicado)
let filtroMesAtual = "todos";

function atualizarResumoLiquido() {
  const liquido = totalBrutoGlobal - totalDespesasGlobal;
  if (valorLiquidoEl) {
    valorLiquidoEl.innerHTML = `<strong>Valor líquido: R$ ${liquido.toFixed(2)}</strong>`;
  }
}

// --- Login --- //
btnLogin.addEventListener("click", async () => {
  const email = usuarioInput.value.trim();
  const senha = senhaInput.value.trim();
  try {
    await signInWithEmailAndPassword(auth, email, senha);
    erroLogin.style.display = "none";
  } catch {
    erroLogin.style.display = "block";
  }
});

// --- Logout --- //
btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

// --- Observa login --- //
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginContainer.style.display = "none";
    adminContainer.style.display = "block";
    criarFiltros();
    carregarAgendamentos();
    carregarDespesas();
    // Espera o layout renderizar para calcular a posição do cabeçalho fixo
    requestAnimationFrame(ajustarHeaderFixo);
    setTimeout(ajustarHeaderFixo, 300); // recalcula após fontes/ícones carregarem
  } else {
    adminContainer.style.display = "none";
    loginContainer.style.display = "flex";
    usuarioInput.value = "";
    senhaInput.value = "";
  }
});

// --- Cabeçalho fixo: mantém os botões sempre visíveis, logo abaixo do
//     cabeçalho do site, independente da rolagem da página --- //
function ajustarHeaderFixo() {
  const siteHeaderEl = document.querySelector(".site-header");
  const adminHeaderEl = document.getElementById("adminHeader");
  const spacerEl = document.getElementById("adminHeaderSpacer");
  if (!siteHeaderEl || !adminHeaderEl || !spacerEl) return;

  const topOffset = siteHeaderEl.offsetHeight;
  adminHeaderEl.style.top = `${topOffset}px`;
  spacerEl.style.height = `${adminHeaderEl.offsetHeight + 10}px`;
}

window.addEventListener("resize", () => {
  if (adminContainer.style.display !== "none") ajustarHeaderFixo();
});

// --- Criar filtros de mês e dia --- //
function criarFiltros() {
  if (document.getElementById("filtrosContainer")) return;
  const filtrosContainer = document.createElement("div");
  filtrosContainer.id = "filtrosContainer";
  filtrosContainer.style.display = "none"; // começa escondido, some botão "🔍 Filtros" que revela
  filtrosContainer.style.justifyContent = "center";
  filtrosContainer.style.alignItems = "center";
  filtrosContainer.style.flexWrap = "wrap";
  filtrosContainer.style.gap = "10px";
  filtrosContainer.style.marginBottom = "15px";

  const selectMes = document.createElement("select");
  selectMes.id = "filtroMes";
  selectMes.style.padding = "6px";
  selectMes.style.borderRadius = "6px";

// Meses do filtro: de Novembro/2025 até 12 meses à frente (atualiza sozinho)
const nomesMesesFiltro = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const meses = [];
{
  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 1);
  for (let d = new Date(2025, 10, 1); d <= fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    meses.push({
      nome: `${nomesMesesFiltro[d.getMonth()]} ${d.getFullYear()}`,
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    });
  }
}

  meses.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.mes;
    opt.textContent = m.nome;
    selectMes.appendChild(opt);
  });

  const inputDia = document.createElement("input");
  inputDia.type = "date";
  inputDia.id = "filtroDia";
  inputDia.style.padding = "6px";
  inputDia.style.borderRadius = "6px";

  const btnFiltrar = document.createElement("button");
  btnFiltrar.textContent = "🔍 Filtrar";
  btnFiltrar.className = "btnSecundario";
  btnFiltrar.onclick = () => {
    filtroMesAtual = selectMes.value;
    carregarAgendamentos();
    carregarDespesas();
  };

  const btnTodosMeses = document.createElement("button");
  btnTodosMeses.textContent = "📅 Todos os Meses";
  btnTodosMeses.className = "btnSecundario";
  btnTodosMeses.onclick = () => {
    filtroMesAtual = "todos";
    inputDia.value = "";
    carregarAgendamentos();
    carregarDespesas();
  };

  filtrosContainer.append(selectMes, inputDia, btnFiltrar, btnTodosMeses);
  adminContainer.insertBefore(filtrosContainer, adminContainer.querySelector(".panel-title"));

  // Botão "🔍 Filtros" no cabeçalho abre/fecha o painel de filtros
  const btnFiltros = document.getElementById("btnFiltros");
  if (btnFiltros) {
    btnFiltros.onclick = () => {
      const aberto = filtrosContainer.style.display === "flex";
      filtrosContainer.style.display = aberto ? "none" : "flex";
    };
  }
}

// --- Disponibilidade: elementos e configuração --- //
const btnDisponibilidade = document.getElementById("btnDisponibilidade");
const modalDisponibilidade = document.getElementById("modalDisponibilidade");
const fecharDisponibilidade = document.getElementById("fecharDisponibilidade");
const salvarDisponibilidadeBtn = document.getElementById("salvarDisponibilidade");
const btnBloquearDia = document.getElementById("btnBloquearDia");
const btnBloquearHorario = document.getElementById("btnBloquearHorario");
const listaDiasBloqueados = document.getElementById("listaDiasBloqueados");
const listaHorariosBloqueados = document.getElementById("listaHorariosBloqueados");

const dispRef = doc(db, "disponibilidade", "config");

const DISPONIBILIDADE_PADRAO = {
  diasSemana: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true },
  periodos: {
    manha: { ativo: true, inicio: 6, fim: 11 },
    tarde: { ativo: true, inicio: 12, fim: 17 },
    noite: { ativo: true, inicio: 18, fim: 20 }
  },
  diasBloqueados: [],
  horariosBloqueados: {}
};

async function carregarConfigDisponibilidade() {
  try {
    const snap = await getDoc(dispRef);
    if (!snap.exists()) return JSON.parse(JSON.stringify(DISPONIBILIDADE_PADRAO));
    const dados = snap.data();
    return {
      diasSemana: { ...DISPONIBILIDADE_PADRAO.diasSemana, ...(dados.diasSemana || {}) },
      periodos: {
        manha: { ...DISPONIBILIDADE_PADRAO.periodos.manha, ...(dados.periodos?.manha || {}) },
        tarde: { ...DISPONIBILIDADE_PADRAO.periodos.tarde, ...(dados.periodos?.tarde || {}) },
        noite: { ...DISPONIBILIDADE_PADRAO.periodos.noite, ...(dados.periodos?.noite || {}) }
      },
      diasBloqueados: dados.diasBloqueados || [],
      horariosBloqueados: dados.horariosBloqueados || {}
    };
  } catch (e) {
    console.error("Erro ao carregar disponibilidade:", e);
    alert(
      "⚠️ Não foi possível carregar a Disponibilidade.\n\n" +
      "Erro: " + (e?.message || e) + "\n\n" +
      "Isso geralmente acontece porque as Regras de Segurança do Firestore ainda não liberam a coleção 'disponibilidade'. " +
      "Veja as instruções que te enviei para atualizar as regras no console do Firebase."
    );
    return JSON.parse(JSON.stringify(DISPONIBILIDADE_PADRAO));
  }
}

function renderListasBloqueios(config) {
  listaDiasBloqueados.innerHTML = "";
  (config.diasBloqueados || []).slice().sort().forEach((data) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>🚫 ${data.split("-").reverse().join("/")}</span>`;
    const btn = document.createElement("button");
    btn.textContent = "Liberar";
    btn.onclick = async () => {
      await setDoc(dispRef, { diasBloqueados: arrayRemove(data) }, { merge: true });
      abrirModalDisponibilidade();
    };
    li.appendChild(btn);
    listaDiasBloqueados.appendChild(li);
  });

  listaHorariosBloqueados.innerHTML = "";
  Object.entries(config.horariosBloqueados || {}).forEach(([data, horarios]) => {
    (horarios || []).forEach((hora) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>🚫 ${data.split("-").reverse().join("/")} às ${hora}</span>`;
      const btn = document.createElement("button");
      btn.textContent = "Liberar";
      btn.onclick = async () => {
        await setDoc(dispRef, { horariosBloqueados: { [data]: arrayRemove(hora) } }, { merge: true });
        abrirModalDisponibilidade();
      };
      li.appendChild(btn);
      listaHorariosBloqueados.appendChild(li);
    });
  });
}

async function abrirModalDisponibilidade() {
  const config = await carregarConfigDisponibilidade();

  document.querySelectorAll(".chkDiaSemana").forEach((chk) => {
    const dia = chk.dataset.dia;
    chk.checked = config.diasSemana[dia] !== false;
  });

  document.getElementById("ativoManha").checked = config.periodos.manha.ativo !== false;
  document.getElementById("inicioManha").value = config.periodos.manha.inicio;
  document.getElementById("fimManha").value = config.periodos.manha.fim;

  document.getElementById("ativoTarde").checked = config.periodos.tarde.ativo !== false;
  document.getElementById("inicioTarde").value = config.periodos.tarde.inicio;
  document.getElementById("fimTarde").value = config.periodos.tarde.fim;

  document.getElementById("ativoNoite").checked = config.periodos.noite.ativo !== false;
  document.getElementById("inicioNoite").value = config.periodos.noite.inicio;
  document.getElementById("fimNoite").value = config.periodos.noite.fim;

  renderListasBloqueios(config);
  modalDisponibilidade.style.display = "flex";
}

if (btnDisponibilidade) {
  btnDisponibilidade.addEventListener("click", abrirModalDisponibilidade);
  fecharDisponibilidade.addEventListener("click", () => modalDisponibilidade.style.display = "none");

  salvarDisponibilidadeBtn.addEventListener("click", async () => {
    const diasSemana = {};
    document.querySelectorAll(".chkDiaSemana").forEach((chk) => {
      diasSemana[chk.dataset.dia] = chk.checked;
    });

    const periodos = {
      manha: {
        ativo: document.getElementById("ativoManha").checked,
        inicio: parseInt(document.getElementById("inicioManha").value, 10),
        fim: parseInt(document.getElementById("fimManha").value, 10)
      },
      tarde: {
        ativo: document.getElementById("ativoTarde").checked,
        inicio: parseInt(document.getElementById("inicioTarde").value, 10),
        fim: parseInt(document.getElementById("fimTarde").value, 10)
      },
      noite: {
        ativo: document.getElementById("ativoNoite").checked,
        inicio: parseInt(document.getElementById("inicioNoite").value, 10),
        fim: parseInt(document.getElementById("fimNoite").value, 10)
      }
    };

    try {
      await setDoc(dispRef, { diasSemana, periodos }, { merge: true });
      alert("✅ Configurações de disponibilidade salvas!");
    } catch (e) {
      console.error("Erro ao salvar disponibilidade:", e);
      alert("⚠️ Erro ao salvar: " + (e?.message || e) + "\n\nVerifique as Regras de Segurança do Firestore para a coleção 'disponibilidade'.");
    }
  });

  btnBloquearDia.addEventListener("click", async () => {
    const data = document.getElementById("dataBloqueioDia").value;
    if (!data) return alert("Escolha uma data para bloquear.");
    try {
      await setDoc(dispRef, { diasBloqueados: arrayUnion(data) }, { merge: true });
      document.getElementById("dataBloqueioDia").value = "";
      abrirModalDisponibilidade();
    } catch (e) {
      console.error("Erro ao bloquear dia:", e);
      alert("⚠️ Erro ao bloquear: " + (e?.message || e));
    }
  });

  btnBloquearHorario.addEventListener("click", async () => {
    const data = document.getElementById("dataBloqueioHorario").value;
    const hora = document.getElementById("horaBloqueioHorario").value;
    if (!data || !hora) return alert("Escolha a data e o horário para bloquear.");
    try {
      await setDoc(dispRef, { horariosBloqueados: { [data]: arrayUnion(hora) } }, { merge: true });
      document.getElementById("dataBloqueioHorario").value = "";
      document.getElementById("horaBloqueioHorario").value = "";
      abrirModalDisponibilidade();
    } catch (e) {
      console.error("Erro ao bloquear horário:", e);
      alert("⚠️ Erro ao bloquear: " + (e?.message || e));
    }
  });

  window.addEventListener("click", (e) => {
    if (e.target === modalDisponibilidade) modalDisponibilidade.style.display = "none";
  });
}

// --- Sincroniza a coleção pública "horariosOcupados" (sem dados pessoais) ---
// usada pelo chat do site para saber quais horários já não estão mais livres.
async function adicionarHorarioOcupado(data, horario) {
  if (!data || !horario) return;
  try {
    await addDoc(collection(db, "horariosOcupados"), { data, horario });
  } catch (e) {
    console.error("Erro ao registrar horário ocupado:", e);
  }
}

async function removerHorarioOcupado(data, horario) {
  if (!data || !horario) return;
  try {
    const snap = await getDocs(
      query(collection(db, "horariosOcupados"), where("data", "==", data), where("horario", "==", horario))
    );
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, "horariosOcupados", docSnap.id));
    }
  } catch (e) {
    console.error("Erro ao liberar horário ocupado:", e);
  }
}

// --- Utilidades --- //
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function brl(n) {
  return "R$ " + Number(n || 0).toFixed(2).replace(".", ",");
}

function tempoRestante(prazoISO) {
  const ms = new Date(prazoISO).getTime() - Date.now();
  if (isNaN(ms)) return { expirado: false, texto: "" };
  if (ms <= 0) return { expirado: true, texto: "Prazo expirado" };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { expirado: false, texto: `${h}h${String(m).padStart(2, "0")}min restantes` };
}

function sinalBadge(ag) {
  if (!ag.sinalValor) return "-";
  if (ag.sinalStatus === "pago") return `<span class="badge-sinal pago">✅ Pago</span>`;
  const t = tempoRestante(ag.sinalPrazo);
  return t.expirado
    ? `<span class="badge-sinal expirado">⚠️ Expirado</span>`
    : `<span class="badge-sinal">⏳ Aguardando</span>`;
}

function atualizarBotaoSinais(pendentes) {
  const btn = document.getElementById("btnSinais");
  if (btn) btn.textContent = pendentes > 0 ? `💰 Sinais (${pendentes})` : "💰 Sinais";
}

const MSG_LOCAL =
  `📍 Local: *Espaço Ana Luiza Makeup*  \n` +
  `Salto Do Lontra-PR\n` +
  `🗺️ https://maps.app.goo.gl/n74UzXbv88cw8Mbq5?g_st=ipc`;

// Abre o WhatsApp; aceita uma janela já aberta (evita bloqueio de pop-up após await)
function abrirWhatsApp(telefone, msg, janela) {
  const tel = (telefone || "").replace(/\D/g, "");
  const link = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
  if (janela && !janela.closed) janela.location.href = link;
  else window.open(link, "_blank");
}

// --- Pagamentos: chave Pix, % da taxa de reserva e prazo --- //
const btnPagamentos = document.getElementById("btnPagamentos");
const modalPagamentos = document.getElementById("modalPagamentos");
const pagRef = doc(db, "configuracoes", "pagamento");

async function abrirModalPagamentos() {
  let cfg = { tipoChave: "CPF", chavePix: "", titular: "", percentualSinal: 50, prazoHoras: 12 };
  try {
    const snap = await getDoc(pagRef);
    if (snap.exists()) cfg = { ...cfg, ...snap.data() };
  } catch (e) {
    console.error("Erro ao carregar pagamentos:", e);
    alert(
      "⚠️ Não foi possível carregar as configurações de Pagamentos.\n\n" +
      "Erro: " + (e?.message || e) + "\n\n" +
      "Verifique as Regras de Segurança do Firestore para a coleção 'configuracoes'."
    );
  }
  document.getElementById("tipoChavePix").value = cfg.tipoChave || "CPF";
  document.getElementById("chavePix").value = cfg.chavePix || "";
  document.getElementById("titularPix").value = cfg.titular || "";
  document.getElementById("percentualSinal").value = cfg.percentualSinal ?? 50;
  document.getElementById("prazoHoras").value = cfg.prazoHoras ?? 12;
  modalPagamentos.style.display = "flex";
}

if (btnPagamentos) {
  btnPagamentos.addEventListener("click", abrirModalPagamentos);
  document.getElementById("fecharPagamentos").addEventListener("click", () => modalPagamentos.style.display = "none");
  window.addEventListener("click", (e) => { if (e.target === modalPagamentos) modalPagamentos.style.display = "none"; });

  document.getElementById("salvarPagamentos").addEventListener("click", async () => {
    const tipoChave = document.getElementById("tipoChavePix").value;
    const chavePix = document.getElementById("chavePix").value.trim();
    const titular = document.getElementById("titularPix").value.trim();
    const percentualSinal = parseFloat(document.getElementById("percentualSinal").value);
    const prazoHoras = parseFloat(document.getElementById("prazoHoras").value);

    if (!chavePix) return alert("Informe a chave Pix.");
    if (!(percentualSinal > 0 && percentualSinal <= 100)) return alert("A taxa de reserva deve ficar entre 1% e 100%.");
    if (!(prazoHoras >= 1)) return alert("O prazo deve ser de pelo menos 1 hora.");

    try {
      await setDoc(pagRef, { tipoChave, chavePix, titular, percentualSinal, prazoHoras }, { merge: true });
      alert("✅ Configurações de pagamento salvas!");
      modalPagamentos.style.display = "none";
    } catch (e) {
      console.error("Erro ao salvar pagamentos:", e);
      alert("⚠️ Erro ao salvar: " + (e?.message || e) + "\n\nVerifique as Regras de Segurança do Firestore para a coleção 'configuracoes'.");
    }
  });
}

// --- Sinais: conferir quem já pagou a taxa de reserva --- //
const btnSinais = document.getElementById("btnSinais");
const modalSinais = document.getElementById("modalSinais");
const listaSinais = document.getElementById("listaSinais");

function msgPagamentoConfirmado(ag) {
  const nome = ag.nome || "Maravilhosa";
  const data = ag.data ? ag.data.split("-").reverse().join("/") : "-";
  const restante = Math.max(Number(ag.valor || 0) - Number(ag.desconto || 0) - Number(ag.sinalValor || 0), 0);
  return (
`Olá ${nome} 😍✨

Recebemos o pagamento da sua taxa de reserva (${brl(ag.sinalValor)}). Muito obrigada! 🥰

Seu horário está confirmado:
📅 *${data}* às *${ag.horario}*
💄 ${ag.procedimento}

O restante (${brl(restante)}) é pago no dia do atendimento. 💖

${MSG_LOCAL}

Lembrando:
• Cancelamentos com no mínimo 7 dias úteis de antecedência;
• Reagendamentos com no mínimo 20 minutos de antecedência do seu horário;
• Tolerância de atraso: 20 minutos.

Te esperamos com muito carinho! 💄✨`
  );
}

async function abrirModalSinais() {
  listaSinais.innerHTML = `<p class="sinal-vazio">Carregando...</p>`;
  modalSinais.style.display = "flex";

  let lista = [];
  try {
    const snap = await getDocs(collection(db, "agendamentos"));
    snap.forEach((d) => {
      const ag = d.data();
      if (!ag.sinalValor) return;
      ag.id = d.id;
      lista.push(ag);
    });
  } catch (e) {
    listaSinais.innerHTML = `<p class="sinal-vazio">Erro ao carregar: ${esc(e?.message || e)}</p>`;
    return;
  }

  // Aguardando primeiro (prazo mais próximo no topo); depois os já pagos (mais recentes primeiro)
  lista.sort((a, b) => {
    const pa = a.sinalStatus === "pago", pb = b.sinalStatus === "pago";
    if (pa !== pb) return pa ? 1 : -1;
    if (!pa) return new Date(a.sinalPrazo) - new Date(b.sinalPrazo);
    return new Date(b.sinalPagoEm || 0) - new Date(a.sinalPagoEm || 0);
  });

  atualizarBotaoSinais(lista.filter((a) => a.sinalStatus !== "pago").length);

  if (!lista.length) {
    listaSinais.innerHTML = `<p class="sinal-vazio">Nenhuma cliente com taxa de reserva até agora.</p>`;
    return;
  }

  listaSinais.innerHTML = "";
  lista.forEach((ag) => {
    const pago = ag.sinalStatus === "pago";
    const tempo = pago ? null : tempoRestante(ag.sinalPrazo);
    const expirado = !!tempo?.expirado;

    const card = document.createElement("div");
    card.className = "sinal-card" + (pago ? " pago" : expirado ? " expirado" : "");

    const statusTxt = pago ? "✅ Pago" : expirado ? "⚠️ Prazo expirado" : `⏳ ${tempo?.texto || "Aguardando"}`;
    const statusCls = pago ? "pago" : expirado ? "expirado" : "";
    const dataBr = ag.data ? ag.data.split("-").reverse().join("/") : "-";
    const restante = Math.max(Number(ag.valor || 0) - Number(ag.desconto || 0) - Number(ag.sinalValor || 0), 0);

    card.innerHTML = `
      <div class="sinal-topo">
        <span class="sinal-nome">${esc(ag.nome) || "-"}</span>
        <span class="sinal-status ${statusCls}">${statusTxt}</span>
      </div>
      <div class="sinal-info">
        📞 ${esc(ag.telefone) || "-"}<br>
        📅 ${dataBr} às ${esc(ag.horario) || "-"} · 💄 ${esc(ag.procedimento) || "-"}<br>
        💰 Reserva: <strong>${brl(ag.sinalValor)}</strong> (${esc(ag.sinalPercentual || 50)}%) via ${esc(ag.sinalForma || ag.formaPagamento || "-")} · Restante: ${brl(restante)}
      </div>
      <div class="sinal-acoes"></div>
    `;
    const acoes = card.querySelector(".sinal-acoes");

    if (!pago) {
      const btnOk = document.createElement("button");
      btnOk.className = "btnPrimario";
      btnOk.textContent = "✅ Pagamento recebido";
      btnOk.onclick = async () => {
        if (!confirm(`Confirmar que ${ag.nome || "a cliente"} já pagou a taxa de reserva de ${brl(ag.sinalValor)}?`)) return;
        const janela = window.open("", "_blank"); // abre antes do await para não ser bloqueada
        try {
          await updateDoc(doc(db, "agendamentos", ag.id), {
            sinalStatus: "pago",
            sinalPagoEm: new Date().toISOString()
          });
        } catch (e) {
          if (janela) janela.close();
          return alert("⚠️ Erro ao confirmar: " + (e?.message || e));
        }
        if ((ag.telefone || "").replace(/\D/g, "")) {
          abrirWhatsApp(ag.telefone, msgPagamentoConfirmado(ag), janela);
        } else {
          if (janela) janela.close();
          alert("Pagamento confirmado, mas a cliente não tem telefone cadastrado para avisar no WhatsApp.");
        }
        abrirModalSinais();
        carregarAgendamentos();
      };
      acoes.appendChild(btnOk);

      const btnLiberar = document.createElement("button");
      btnLiberar.className = "btnPerigo";
      btnLiberar.textContent = "🗑️ Liberar horário";
      btnLiberar.onclick = async () => {
        if (!confirm(`Excluir o agendamento de ${ag.nome || "a cliente"} e liberar ${dataBr} às ${ag.horario} para outras clientes?`)) return;
        await deleteDoc(doc(db, "agendamentos", ag.id));
        await removerHorarioOcupado(ag.data, ag.horario);
        abrirModalSinais();
        carregarAgendamentos();
      };
      acoes.appendChild(btnLiberar);
    } else {
      const btnDesfazer = document.createElement("button");
      btnDesfazer.className = "btnSecundario";
      btnDesfazer.textContent = "↩️ Desfazer confirmação";
      btnDesfazer.onclick = async () => {
        if (!confirm("Voltar este pagamento para 'aguardando'?")) return;
        await updateDoc(doc(db, "agendamentos", ag.id), { sinalStatus: "aguardando", sinalPagoEm: null });
        abrirModalSinais();
        carregarAgendamentos();
      };
      acoes.appendChild(btnDesfazer);
    }

    listaSinais.appendChild(card);
  });
}

if (btnSinais) {
  btnSinais.addEventListener("click", abrirModalSinais);
  document.getElementById("fecharSinais").addEventListener("click", () => modalSinais.style.display = "none");
  window.addEventListener("click", (e) => { if (e.target === modalSinais) modalSinais.style.display = "none"; });
}

// --- Carregar agendamentos --- //
async function carregarAgendamentos() {
  const querySnapshot = await getDocs(collection(db, "agendamentos"));
  tabelaAgendamentos.innerHTML = "";

  const filtroMes = filtroMesAtual;
  const filtroDia = document.getElementById("filtroDia")?.value || "";

  let agendamentos = [];
  querySnapshot.forEach((docSnap) => {
    const ag = docSnap.data();
    if (!ag.data) return;
    ag.id = docSnap.id;
    agendamentos.push(ag);
  });

const ordemPeriodo = {
  "Manhã": 1,
  "Tarde": 2,
  "Noite": 3
};

agendamentos.sort((a, b) => {
  // 1️⃣ Ordena pela data
  const dataA = new Date(a.data);
  const dataB = new Date(b.data);
  if (dataA.getTime() !== dataB.getTime()) {
    return dataA - dataB;
  }

  // 2️⃣ Se for o mesmo dia, ordena pelo período
  const periodoA = ordemPeriodo[a.periodo] || 99;
  const periodoB = ordemPeriodo[b.periodo] || 99;
  if (periodoA !== periodoB) {
    return periodoA - periodoB;
  }

  // 3️⃣ Se ainda empatar, ordena pelo horário
  return (a.horario || "").localeCompare(b.horario || "");
});

  atualizarBotaoSinais(agendamentos.filter((a) => a.sinalStatus === "aguardando").length);

  let total = 0;
  let pagamentos = {};
  let contador = 0;

  agendamentos.forEach((ag) => {
    const dataBase = ag.data.slice(0, 7);
    if (filtroMes !== "todos" && dataBase !== filtroMes) return;
    if (filtroDia && ag.data !== filtroDia) return;

    const valor = Number(ag.valor || 0);
    const desconto = Number(ag.desconto || 0);
    const valorFinal = Math.max(valor - desconto, 0);
    const concluido = ag.concluido === true;

    contador++;
    total += valorFinal;
    if (ag.formaPagamento)
      pagamentos[ag.formaPagamento] = (pagamentos[ag.formaPagamento] || 0) + valorFinal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(ag.nome) || "-"}</td>
      <td>${esc(ag.telefone) || "-"}</td>
      <td>${ag.aniversario && ag.aniversario !== "Não informado" ? esc(ag.aniversario) : "-"}</td>
      <td>${ag.data ? ag.data.split("-").reverse().join("/") : "-"}</td>
      <td>${esc(ag.periodo) || "-"}</td>
      <td>${esc(ag.horario) || "-"}</td>
      <td>${esc(ag.procedimento) || "-"}</td>
      <td>${esc(ag.formaPagamento) || "-"}</td>
      <td>R$ ${valor.toFixed(2)}</td>
      <td>${desconto > 0 ? "Sim (R$ " + desconto.toFixed(2) + ")" : "Não"}</td>
      <td><strong>R$ ${valorFinal.toFixed(2)}</strong></td>
      <td>${sinalBadge(ag)}</td>
      <td><input type="checkbox" class="chkConcluir" data-id="${ag.id}" ${concluido ? "checked" : ""}></td>
      <td>
        <button class="btnAcoes"
          data-id="${ag.id}"
          data-tel="${esc(ag.telefone)}"
          data-nome="${esc(ag.nome)}"
          data-data="${esc(ag.data)}"
          data-periodo="${esc(ag.periodo)}"
          data-horario="${esc(ag.horario)}"
          data-procedimento="${esc(ag.procedimento)}"
          data-valor="${(ag.valor - (ag.desconto || 0)).toFixed(2)}">
          ⚙️ Ações
        </button>
      </td>
    `;
    tabelaAgendamentos.appendChild(tr);
  });

  totalAgendamentos.textContent = `Total de agendamentos: ${contador}`;
  valorTotal.textContent = `Valor bruto (atendimentos): R$ ${total.toFixed(2)}`;
  totalBrutoGlobal = total;
  atualizarResumoLiquido();

  let resumoHTML = "<h4>Formas de Pagamento:</h4><ul>";
  for (const [forma, valor] of Object.entries(pagamentos))
    resumoHTML += `<li>${forma}: R$ ${valor.toFixed(2)}</li>`;
  resumoHTML += "</ul>";
  pagamentosResumo.innerHTML = resumoHTML;

  document.querySelectorAll(".chkConcluir").forEach((chk) => {
    chk.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const concluido = e.target.checked;
      await updateDoc(doc(db, "agendamentos", id), { concluido });
      if (concluido) alert("💖 Mais um atendimento concluído! Parabéns, Ana! 🎉✨");
    });
  });
}

// --- Despesas: carregar --- //
async function carregarDespesas() {
  if (!tabelaDespesas) return;
  const querySnapshot = await getDocs(collection(db, "despesas"));
  tabelaDespesas.innerHTML = "";

  const filtroMes = filtroMesAtual;
  const filtroDia = document.getElementById("filtroDia")?.value || "";

  let despesas = [];
  querySnapshot.forEach((docSnap) => {
    const d = docSnap.data();
    if (!d.data) return;
    d.id = docSnap.id;
    despesas.push(d);
  });

  despesas.sort((a, b) => new Date(a.data) - new Date(b.data));

  let totalDespesas = 0;

  despesas.forEach((d) => {
    const dataBase = d.data.slice(0, 7);
    if (filtroMes !== "todos" && dataBase !== filtroMes) return;
    if (filtroDia && d.data !== filtroDia) return;

    const valor = Number(d.valor || 0);
    totalDespesas += valor;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.nome || "-"}</td>
      <td>${d.data ? d.data.split("-").reverse().join("/") : "-"}</td>
      <td>${d.descricao || "-"}</td>
      <td>${d.formaPagamento || "-"}</td>
      <td>R$ ${valor.toFixed(2)}</td>
      <td>
        <button class="btnPerigo btnExcluirDespesa" data-id="${d.id}">🗑️ Excluir</button>
      </td>
    `;
    tabelaDespesas.appendChild(tr);
  });

  if (valorDespesasEl) valorDespesasEl.textContent = `Despesas: R$ ${totalDespesas.toFixed(2)}`;
  totalDespesasGlobal = totalDespesas;
  atualizarResumoLiquido();

  document.querySelectorAll(".btnExcluirDespesa").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.dataset.id;
      if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
      await deleteDoc(doc(db, "despesas", id));
      carregarDespesas();
    });
  });
}

// --- Despesas: modal Nova Despesa --- //
if (btnNovaDespesa && modalDespesa) {
  btnNovaDespesa.addEventListener("click", () => {
    modalDespesa.style.display = "flex";
  });

  fecharModalDespesa.addEventListener("click", () => {
    modalDespesa.style.display = "none";
  });

  salvarDespesaBtn.addEventListener("click", async () => {
    const nome = document.getElementById("nomeDespesa").value.trim();
    const data = document.getElementById("dataDespesa").value;
    const descricao = document.getElementById("descricaoDespesa").value.trim();
    const valor = parseFloat(document.getElementById("valorDespesa").value || 0);
    const formaPagamento = document.getElementById("pagamentoDespesa").value;

    if (!nome || !data || !valor) {
      alert("Preencha todos os campos da despesa!");
      return;
    }

    await addDoc(collection(db, "despesas"), { nome, data, descricao, valor, formaPagamento });

    alert("✅ Despesa adicionada!");
    modalDespesa.style.display = "none";
    document.getElementById("nomeDespesa").value = "";
    document.getElementById("dataDespesa").value = "";
    document.getElementById("descricaoDespesa").value = "";
    document.getElementById("valorDespesa").value = "";
    carregarDespesas();
  });
}

// --- Modal de Ações --- //
const modalAcoes = document.getElementById("modalAcoes");
const fecharAcoes = document.getElementById("fecharAcoes");
const btnFecharModalAcoes = document.getElementById("acaoFechar");

let agendamentoSelecionado = null;

// Abrir modal
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btnAcoes")) {
    const btn = e.target;
    agendamentoSelecionado = { 
      id: btn.dataset.id,
      nome: btn.dataset.nome,
      telefone: btn.dataset.tel,
      data: btn.dataset.data,
      periodo: btn.dataset.periodo,
      horario: btn.dataset.horario,
      procedimento: btn.dataset.procedimento,
      valor: btn.dataset.valor
    };
    modalAcoes.style.display = "flex";
  }
});

// Fechar modal
fecharAcoes.onclick = () => modalAcoes.style.display = "none";
btnFecharModalAcoes.onclick = () => modalAcoes.style.display = "none";
window.onclick = (e) => { if (e.target === modalAcoes) modalAcoes.style.display = "none"; };

// --- Editar --- //
document.getElementById("acaoEditar").onclick = async () => {
  modalAcoes.style.display = "none";
  const docSnap = await getDocs(collection(db, "agendamentos"));
  const ag = docSnap.docs.find(d => d.id === agendamentoSelecionado.id)?.data();
  if (!ag) return alert("Erro ao carregar o atendimento!");

  document.getElementById("modalNovo").style.display = "flex";
  document.getElementById("nomeManual").value = ag.nome || "";
  document.getElementById("telefoneManual").value = ag.telefone || "";
  document.getElementById("dataManual").value = ag.data || "";
  document.getElementById("periodoManual").value = ag.periodo || "Manhã";
  document.getElementById("horaManual").value = ag.horario || "";
  document.getElementById("procedimentoManual").value = ag.procedimento || "";
  document.getElementById("pagamentoManual").value = ag.formaPagamento || "PIX";
  document.getElementById("valorManual").value = ag.valor || "";
  document.getElementById("descontoManual").value = ag.desconto || "";
  document.getElementById("obsManual").value = ag.observacoes || "";

  const btnSalvar = document.getElementById("salvarManual");
  btnSalvar.textContent = "💾 Salvar Alterações";
  btnSalvar.onclick = async () => {
    const nome = document.getElementById("nomeManual").value.trim();
    const telefone = document.getElementById("telefoneManual").value.trim();
    const data = document.getElementById("dataManual").value;
    const periodo = document.getElementById("periodoManual").value;
    const horario = document.getElementById("horaManual").value;
    const procedimento = document.getElementById("procedimentoManual").value.trim();
    const formaPagamento = document.getElementById("pagamentoManual").value;
    const valor = parseFloat(document.getElementById("valorManual").value || 0);
    const desconto = parseFloat(document.getElementById("descontoManual").value || 0);
    const obs = document.getElementById("obsManual").value.trim();

    await updateDoc(doc(db, "agendamentos", agendamentoSelecionado.id), {
      nome, telefone, data, periodo, horario, procedimento, formaPagamento, valor, desconto, observacoes: obs
    });

    // Atualiza a coleção pública de horários ocupados caso a data/horário tenham mudado
    if (ag.data !== data || ag.horario !== horario) {
      await removerHorarioOcupado(ag.data, ag.horario);
      await adicionarHorarioOcupado(data, horario);
    }

    alert("✅ Atendimento atualizado!");
    document.getElementById("modalNovo").style.display = "none";
    carregarAgendamentos();
    btnSalvar.textContent = "💾 Salvar Atendimento";
    btnSalvar.onclick = salvarNovoAtendimento;
  };
};

// --- WhatsApp --- //
document.getElementById("acaoWhats").onclick = () => {
  modalAcoes.style.display = "none";
  const nome = agendamentoSelecionado.nome || "Maravilhosa";
  const tel = (agendamentoSelecionado.telefone || "").replace(/\D/g, "");
  const data = agendamentoSelecionado.data
    ? agendamentoSelecionado.data.split("-").reverse().join("/")
    : "-";

  const msg = `
Olá ${nome} 😍✨

Seu atendimento está confirmado para *${data}*, período *${agendamentoSelecionado.periodo}*, às *${agendamentoSelecionado.horario}*.
Procedimento: *${agendamentoSelecionado.procedimento}*.
Valor: *R$ ${agendamentoSelecionado.valor}* 💖

📍 Local: *Espaço Ana Luiza Makeup*  
Salto Do Lontra-PR
🗺️ https://maps.app.goo.gl/n74UzXbv88cw8Mbq5?g_st=ipc

Te esperamos com muito carinho! 💄✨
`;

  if (!tel) return alert("Telefone não informado!");
  const link = `https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`;
  window.open(link, "_blank");
};

// --- Aviso de atraso (tolerância de 20 minutos) --- //
document.getElementById("acaoAtraso").onclick = () => {
  modalAcoes.style.display = "none";
  const nome = agendamentoSelecionado.nome || "Maravilhosa";
  if (!(agendamentoSelecionado.telefone || "").replace(/\D/g, "")) return alert("Telefone não informado!");
  const msg =
`Olá ${nome}! 😊

O tempo máximo de espera é de 20 minutos. Como o atraso ultrapassou esse período, não conseguirei mais realizar seu atendimento hoje. Podemos remarcar novamente em um dia que você esteja com tempo?`;
  abrirWhatsApp(agendamentoSelecionado.telefone, msg);
};

// --- Excluir --- //
document.getElementById("acaoExcluir").onclick = async () => {
  if (!confirm("Tem certeza que deseja excluir este atendimento?")) return;
  await deleteDoc(doc(db, "agendamentos", agendamentoSelecionado.id));
  await removerHorarioOcupado(agendamentoSelecionado.data, agendamentoSelecionado.horario);
  alert("🗑️ Atendimento excluído!");
  modalAcoes.style.display = "none";
  carregarAgendamentos();
};

// --- Apagar todos DESATIVADO por segurança --- //
/*
btnApagarTudo.addEventListener("click", async () => {
  if (!confirm("Tem certeza que deseja apagar todos os agendamentos?")) return;
  const querySnapshot = await getDocs(collection(db, "agendamentos"));
  for (const docSnap of querySnapshot.docs)
    await deleteDoc(doc(db, "agendamentos", docSnap.id));
  alert("Todos foram apagados!");
  carregarAgendamentos();
});
*/

// --- Novo Atendimento --- //
btnNovoAtendimento.addEventListener("click", () => {
  document.getElementById("modalNovo").style.display = "flex";
});

const btnFecharModal = document.getElementById("fecharModal");
btnFecharModal.addEventListener("click", () => {
  document.getElementById("modalNovo").style.display = "none";
});

async function salvarNovoAtendimento() {
  const nome = document.getElementById("nomeManual").value.trim();
  const telefone = document.getElementById("telefoneManual")?.value.trim() || "";
  const data = document.getElementById("dataManual").value;
  const periodo = document.getElementById("periodoManual").value;
  const horario = document.getElementById("horaManual").value;
  const procedimento = document.getElementById("procedimentoManual").value.trim();
  const formaPagamento = document.getElementById("pagamentoManual").value;
  const valor = parseFloat(document.getElementById("valorManual").value || 0);
  const desconto = parseFloat(document.getElementById("descontoManual").value || 0);
  const obs = document.getElementById("obsManual").value.trim();

  if (!nome || !data || !horario || !procedimento) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  await addDoc(collection(db, "agendamentos"), {
    nome, telefone, data, periodo, horario, procedimento,
    formaPagamento, valor, desconto, observacoes: obs, concluido: false
  });
  await adicionarHorarioOcupado(data, horario);

  alert("✅ Atendimento adicionado!");
  document.getElementById("modalNovo").style.display = "none";
  document.querySelectorAll("#modalNovo input, #modalNovo textarea").forEach(el => el.value = "");
  carregarAgendamentos();
}
document.getElementById("salvarManual").onclick = salvarNovoAtendimento;

document.addEventListener("DOMContentLoaded", () => {
  loginContainer.style.display = "flex";
});

async function exportarPDF(mes) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  // --- Página 1: Agendamentos --- //
  const querySnapshot = await getDocs(collection(db, "agendamentos"));
  let linhas = [];
  let totalBruto = 0;

  querySnapshot.forEach(docSnap => {
    const ag = docSnap.data();
    if (ag.data?.startsWith(mes)) {
      const valorFinal = Math.max(
        Number(ag.valor || 0) - Number(ag.desconto || 0),
        0
      );

      totalBruto += valorFinal;

      linhas.push([
        ag.nome || "-",
        ag.telefone || "-",
        ag.data.split("-").reverse().join("/"),
        ag.procedimento || "-",
        ag.formaPagamento || "-",
        `R$ ${valorFinal.toFixed(2)}`
      ]);
    }
  });

  // --- Despesas do mês --- //
  const despesasSnapshot = await getDocs(collection(db, "despesas"));
  let linhasDespesas = [];
  let totalDespesas = 0;

  despesasSnapshot.forEach(docSnap => {
    const d = docSnap.data();
    if (d.data?.startsWith(mes)) {
      const valor = Number(d.valor || 0);
      totalDespesas += valor;

      linhasDespesas.push([
        d.nome || "-",
        d.data.split("-").reverse().join("/"),
        d.descricao || "-",
        d.formaPagamento || "-",
        `R$ ${valor.toFixed(2)}`
      ]);
    }
  });

  if (!linhas.length && !linhasDespesas.length) {
    alert("Nenhum dado encontrado para este mês.");
    return false;
  }

  // Página 1 — Agendamentos
  pdf.text(`Relatório de Agendamentos - ${mes}`, 14, 15);
  if (linhas.length) {
    pdf.autoTable({
      startY: 25,
      head: [["Nome", "Telefone", "Data", "Procedimento", "Pagamento", "Valor"]],
      body: linhas,
      styles: { fontSize: 9 }
    });
  } else {
    pdf.setFontSize(10);
    pdf.text("Nenhum atendimento neste mês.", 14, 30);
  }
  const yAgendamentos = pdf.lastAutoTable?.finalY || 40;
  pdf.text(`Total bruto (atendimentos): R$ ${totalBruto.toFixed(2)}`, 14, yAgendamentos + 10);

  // Página 2 — Despesas (nova planilha/página do relatório)
  pdf.addPage();
  pdf.text(`Despesas - ${mes}`, 14, 15);
  if (linhasDespesas.length) {
    pdf.autoTable({
      startY: 25,
      head: [["Despesa", "Data", "Descrição", "Pagamento", "Valor"]],
      body: linhasDespesas,
      styles: { fontSize: 9 }
    });
  } else {
    pdf.setFontSize(10);
    pdf.text("Nenhuma despesa registrada neste mês.", 14, 30);
  }
  const yDespesas = pdf.lastAutoTable?.finalY || 40;
  pdf.text(`Total de despesas: R$ ${totalDespesas.toFixed(2)}`, 14, yDespesas + 10);

  // --- Resumo Financeiro final (já descontando as despesas) --- //
  const totalLiquido = totalBruto - totalDespesas;
  pdf.setFontSize(12);
  pdf.text("Resumo Financeiro", 14, yDespesas + 25);
  pdf.setFontSize(10);
  pdf.text(`Total bruto: R$ ${totalBruto.toFixed(2)}`, 14, yDespesas + 33);
  pdf.text(`Total de despesas: R$ ${totalDespesas.toFixed(2)}`, 14, yDespesas + 40);
  pdf.setFontSize(11);
  pdf.text(`Total líquido: R$ ${totalLiquido.toFixed(2)}`, 14, yDespesas + 49);

  pdf.save(`agendamentos-${mes}.pdf`);
  return true;
}

async function apagarPorMes(mes) {
  const querySnapshot = await getDocs(collection(db, "agendamentos"));

  for (const docSnap of querySnapshot.docs) {
    const ag = docSnap.data();
    if (ag.data?.startsWith(mes)) {
      await deleteDoc(doc(db, "agendamentos", docSnap.id));
      await removerHorarioOcupado(ag.data, ag.horario);
    }
  }

  const despesasSnapshot = await getDocs(collection(db, "despesas"));
  for (const docSnap of despesasSnapshot.docs) {
    const d = docSnap.data();
    if (d.data?.startsWith(mes)) {
      await deleteDoc(doc(db, "despesas", docSnap.id));
    }
  }

  alert(`Agendamentos e despesas de ${mes} apagados com sucesso.`);
}


let pdfExportado = false;

btnExportar.onclick = async () => {
  const mes = filtroMesAtual;
  if (mes === "todos") return alert("Selecione um mês específico (o filtro está em 'Todos os Meses').");
  pdfExportado = await exportarPDF(mes);
};

btnApagarMes.onclick = async () => {
  if (!pdfExportado) {
    alert("⚠️ Exporte o PDF antes de apagar.");
    return;
  }

  const mes = filtroMesAtual;
  if (mes === "todos") return alert("Selecione um mês específico (o filtro está em 'Todos os Meses').");
  if (!confirm(`Tem certeza que deseja apagar os dados de ${mes}?`)) return;

  await apagarPorMes(mes);
  pdfExportado = false;
  carregarAgendamentos();
  carregarDespesas();
};

const btnEsqueci = document.getElementById("btnEsqueciSenha");
const modalSenha = document.getElementById("modalSenha");
const fecharSenha = document.getElementById("fecharSenha");
const enviarSenha = document.getElementById("enviarSenha");

btnEsqueci.onclick = () => modalSenha.style.display = "flex";
fecharSenha.onclick = () => modalSenha.style.display = "none";

enviarSenha.onclick = () => {
  const email = document.getElementById("emailRecuperacao").value;
  const senha = document.getElementById("novaSenha").value;

  if (!email || !senha) {
    alert("Preencha todos os campos.");
    return;
  }

  const mensagem = `
🔐 *Solicitação de Alteração de Senha*

📧 Email: ${email}
🔑 Nova senha: ${senha}

Solicitação enviada pelo Painel Administrativo.
  `;

  const whatsapp = `https://wa.me/5546999711937?text=${encodeURIComponent(mensagem)}`;
  window.open(whatsapp, "_blank");

  modalSenha.style.display = "none";
};