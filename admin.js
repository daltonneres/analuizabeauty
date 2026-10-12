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
  arrayRemove,
  deleteField,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { CATALOGO_PADRAO, criarIdCatalogo, formatarTempoMedio, tempoMedioConfigurado, calcularTempoMedio } from "./catalogo.js";

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
const btnOcultarValores = document.getElementById("btnOcultarValores");
const tabelaAgenda = document.querySelector('table[aria-label="Tabela de agendamentos"]');
btnOcultarValores?.addEventListener("click", () => {
  const ocultos = tabelaAgenda?.classList.toggle("valores-ocultos") ?? false;
  btnOcultarValores.setAttribute("aria-pressed", String(ocultos));
  btnOcultarValores.setAttribute("aria-label", `${ocultos ? "Mostrar" : "Ocultar"} valores dos agendamentos`);
  btnOcultarValores.title = `${ocultos ? "Mostrar" : "Ocultar"} valores`;
  btnOcultarValores.innerHTML = `<i class="fa-regular ${ocultos ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i>`;
});
const btnOcultarValoresFinanceiro = document.getElementById("btnOcultarValoresFinanceiro");
const painelFinanceiro = document.getElementById("financeiroPanel");
btnOcultarValoresFinanceiro?.addEventListener("click", () => {
  const ocultos = painelFinanceiro?.classList.toggle("valores-ocultos") ?? false;
  btnOcultarValoresFinanceiro.setAttribute("aria-pressed", String(ocultos));
  btnOcultarValoresFinanceiro.setAttribute("aria-label", `${ocultos ? "Mostrar" : "Ocultar"} valores financeiros`);
  btnOcultarValoresFinanceiro.title = `${ocultos ? "Mostrar" : "Ocultar"} valores`;
  btnOcultarValoresFinanceiro.innerHTML = `<i class="fa-regular ${ocultos ? "fa-eye-slash" : "fa-eye"}" aria-hidden="true"></i>`;
});
const totalAgendamentos = document.getElementById("totalAgendamentos");
const valorTotal = document.getElementById("valorTotal");
const pagamentosResumo = document.getElementById("pagamentosResumo");
const btnExportar = document.getElementById("btnExportar");
const btnApagarMes = document.getElementById("btnApagarMes");
const btnNovoAtendimento = document.getElementById("btnNovoAtendimento");

let catalogoItens = CATALOGO_PADRAO.map((item) => ({ ...item, ativo: true }));
let catalogoProcedimentos = Object.fromEntries(catalogoItens.map((item) => [item.nome, item.valor]));

// --- Despesas: elementos --- //
const tabelaDespesas = document.getElementById("tabelaDespesas");
const valorDespesasEl = document.getElementById("valorDespesas");
const valorDescontosEl = document.getElementById("valorDescontos");
const valorLiquidoEl = document.getElementById("valorLiquido");
const btnNovaDespesa = document.getElementById("btnNovaDespesa");
const modalDespesa = document.getElementById("modalDespesa");
const fecharModalDespesa = document.getElementById("fecharModalDespesa");
const salvarDespesaBtn = document.getElementById("salvarDespesa");

// Totais globais usados para calcular o valor líquido (bruto - despesas)
let totalBrutoGlobal = 0;
let totalDescontosGlobal = 0;
let totalDespesasGlobal = 0;

// Estado do filtro de mês: "todos" por padrão (antes controlado pela opção
// "Todos os Meses" dentro do <select>, agora controlado pelo botão dedicado)
let filtroMesAtual = "todos";

function atualizarResumoLiquido() {
  const liquido = totalBrutoGlobal - totalDescontosGlobal - totalDespesasGlobal;
  if (valorLiquidoEl) {
    valorLiquidoEl.innerHTML = `<span>Resultado líquido</span><strong>${brl(liquido)}</strong>`;
  }
}

const modalValoresServicos = document.getElementById("modalValoresServicos");
const valoresServicosRef = doc(db, "configuracoes", "servicos");
const listaValoresServicos = document.getElementById("listaValoresServicos");
const formProdutoCatalogo = document.getElementById("formProdutoCatalogo");
const catalogoContagem = document.getElementById("catalogoContagem");
const campoProdutoNome = document.getElementById("produtoNome");
const campoProdutoTipo = document.getElementById("produtoTipo");
const campoProdutoValor = document.getElementById("produtoValor");
const campoProdutoDescricao = document.getElementById("produtoDescricao");
const campoProdutoTempoMedio = document.getElementById("produtoTempoMedio");
const avisoTempoCatalogo = document.getElementById("catalogoAvisoTempo");
const badgeTempoCatalogo = document.getElementById("catalogoPendenciasBadge");

function itensSemTempoMedio() {
  return catalogoItens.filter((item) => !tempoMedioConfigurado(item));
}

function atualizarPendenciasTempoMedio() {
  const pendentes = itensSemTempoMedio();
  if (avisoTempoCatalogo) {
    avisoTempoCatalogo.hidden = pendentes.length === 0;
    avisoTempoCatalogo.querySelector("strong").textContent = `${pendentes.length} ${pendentes.length === 1 ? "item ainda precisa" : "itens ainda precisam"} de tempo médio.`;
  }
  if (badgeTempoCatalogo) {
    badgeTempoCatalogo.hidden = pendentes.length === 0;
    badgeTempoCatalogo.textContent = String(pendentes.length);
    badgeTempoCatalogo.setAttribute("aria-label", `${pendentes.length} itens sem tempo médio`);
  }
  if (catalogoContagem) {
    const total = catalogoItens.length;
    catalogoContagem.textContent = `${total} ${total === 1 ? "item cadastrado" : "itens cadastrados"}${pendentes.length ? ` · ${pendentes.length} ${pendentes.length === 1 ? "pendência" : "pendências"} de tempo` : " · catálogo completo"}`;
  }
  return pendentes;
}

function atualizarMapaCatalogo() {
  catalogoProcedimentos = Object.fromEntries(
    catalogoItens.filter((item) => item.ativo !== false).map((item) => [item.nome, Number(item.valor) || 0])
  );
  atualizarListaProcedimentosManual();
}

function tempoMedioDoProcedimento(procedimento) {
  return calcularTempoMedio(procedimento, catalogoItens);
}

function renderizarEditorPrecos() {
  listaValoresServicos.innerHTML = "";
  atualizarPendenciasTempoMedio();
  catalogoItens.forEach((item) => {
    const linha = document.createElement("div");
    linha.className = "service-price-row-admin";
    const detalhes = document.createElement("div");
    detalhes.className = "catalogo-item-detalhes";
    const topo = document.createElement("div");
    topo.className = "catalogo-item-topo";
    const nome = document.createElement("strong");
    nome.textContent = item.nome;
    const tipo = document.createElement("span");
    tipo.className = "catalogo-tipo";
    tipo.textContent = item.tipo === "combo" ? "Combo" : item.tipo === "produto" ? "Produto" : "Serviço";
    topo.append(nome, tipo);
    const descricao = document.createElement("p");
    descricao.textContent = item.descricao || "Sem descrição";
    const valor = document.createElement("span");
    valor.className = "catalogo-item-valor";
    valor.textContent = brl(item.valor);
    const tempo = document.createElement("span");
    tempo.className = `catalogo-item-tempo${tempoMedioConfigurado(item) ? "" : " pendente"}`;
    tempo.innerHTML = `<i class="fa-regular fa-clock" aria-hidden="true"></i> ${tempoMedioConfigurado(item) ? `Tempo médio: ${formatarTempoMedio(item.tempoMedioMinutos)}` : "Tempo médio pendente"}`;
    detalhes.append(topo, descricao, valor, tempo);
    const acoes = document.createElement("div");
    acoes.className = "catalogo-item-acoes";
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "btnSecundario";
    editar.dataset.acaoCatalogo = "editar";
    editar.dataset.id = item.id;
    editar.textContent = "Editar";
    const excluir = document.createElement("button");
    excluir.type = "button";
    excluir.className = "btnSecundario catalogo-excluir";
    excluir.dataset.acaoCatalogo = "excluir";
    excluir.dataset.id = item.id;
    excluir.textContent = "Excluir";
    acoes.append(editar, excluir);
    linha.append(detalhes, acoes);
    listaValoresServicos.appendChild(linha);
  });
}

function abrirFormularioProduto(item = null) {
  formProdutoCatalogo.reset();
  formProdutoCatalogo.dataset.editandoId = item?.id || "";
  document.getElementById("tituloFormProduto").textContent = item ? "Editar item" : "Novo item";
  formProdutoCatalogo.querySelector('[type="submit"]').textContent = item ? "Salvar alterações" : "Adicionar ao catálogo";
  campoProdutoNome.value = item?.nome || "";
  campoProdutoTipo.value = item?.tipo || "servico";
  campoProdutoValor.value = item ? Number(item.valor).toFixed(2) : "";
  campoProdutoDescricao.value = item?.descricao || "";
  campoProdutoTempoMedio.value = tempoMedioConfigurado(item) ? String(item.tempoMedioMinutos) : "";
  formProdutoCatalogo.hidden = false;
  campoProdutoNome.focus();
}

function fecharFormularioProduto() {
  formProdutoCatalogo.hidden = true;
  formProdutoCatalogo.dataset.editandoId = "";
  formProdutoCatalogo.reset();
}

document.getElementById("btnNovoProduto").addEventListener("click", () => abrirFormularioProduto());
document.getElementById("cancelarProduto").addEventListener("click", fecharFormularioProduto);
listaValoresServicos.addEventListener("click", (evento) => {
  const botao = evento.target.closest("[data-acao-catalogo]");
  if (!botao) return;
  const indice = catalogoItens.findIndex((item) => item.id === botao.dataset.id);
  if (indice < 0) return;
  if (botao.dataset.acaoCatalogo === "editar") return abrirFormularioProduto(catalogoItens[indice]);
  if (!confirm(`Remover “${catalogoItens[indice].nome}” do catálogo?`)) return;
  catalogoItens.splice(indice, 1);
  atualizarMapaCatalogo();
  renderizarEditorPrecos();
  atualizarPendenciasTempoMedio();
});

formProdutoCatalogo.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const nome = campoProdutoNome.value.trim();
  const valor = Number(campoProdutoValor.value);
  const tempoMedioMinutos = Number(campoProdutoTempoMedio.value);
  if (!nome || !Number.isFinite(valor) || valor < 0) return alert("Informe um nome e um valor válido para o item.");
  if (!Number.isInteger(tempoMedioMinutos) || tempoMedioMinutos <= 0) return alert("Informe o tempo médio de atendimento em minutos.");
  const editandoId = formProdutoCatalogo.dataset.editandoId;
  const duplicado = catalogoItens.some((item) => item.id !== editandoId && item.nome.trim().toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
  if (duplicado) return alert("Já existe um item com esse nome no catálogo.");
  const existente = catalogoItens.find((item) => item.id === editandoId);
  const item = {
    id: existente?.id || (crypto.randomUUID ? crypto.randomUUID() : `${criarIdCatalogo(nome)}-${Date.now()}`),
    nome,
    descricao: campoProdutoDescricao.value.trim(),
    valor,
    tempoMedioMinutos,
    tipo: campoProdutoTipo.value,
    ativo: true
  };
  if (existente) Object.assign(existente, item);
  else catalogoItens.push(item);
  atualizarMapaCatalogo();
  renderizarEditorPrecos();
  atualizarPendenciasTempoMedio();
  fecharFormularioProduto();
});

function atualizarListaProcedimentosManual() {
  if (!catalogoManual) return;
  catalogoManual.innerHTML = "";
  Object.keys(catalogoProcedimentos).forEach((nome) => {
    const option = document.createElement("option");
    option.value = nome;
    catalogoManual.appendChild(option);
  });
}
async function carregarCatalogoPrecosAdmin() {
  const snap = await getDoc(valoresServicosRef);
  const dados = snap.exists() ? snap.data() : {};
  if (Array.isArray(dados.catalogo)) {
    catalogoItens = dados.catalogo
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
    catalogoItens = CATALOGO_PADRAO.map((item) => ({ ...item, valor: Number(precosLegados[item.nome] ?? item.valor), ativo: true }));
    Object.entries(precosLegados).forEach(([nome, valor]) => {
      if (!catalogoItens.some((item) => item.nome === nome)) {
        catalogoItens.push({ id: criarIdCatalogo(nome) || `item-${Date.now()}`, nome, descricao: "", valor: Number(valor) || 0, tipo: "produto", ativo: true });
      }
    });
  }
  atualizarMapaCatalogo();
  atualizarPendenciasTempoMedio();
  return catalogoProcedimentos;
}
async function abrirEditorPrecos(catalogoCarregado = false) {
  try {
    if (!catalogoCarregado) await carregarCatalogoPrecosAdmin();
    renderizarEditorPrecos();
    atualizarPendenciasTempoMedio();
    modalValoresServicos.style.display = "flex";
  } catch (e) {
    console.error("Erro ao carregar valores dos procedimentos:", e);
    alert("Não foi possível carregar os valores. Verifique a conexão e tente novamente.");
  }
}
document.getElementById("btnValoresServicos").addEventListener("click", () => abrirEditorPrecos());
document.getElementById("fecharValoresServicos").addEventListener("click", () => { modalValoresServicos.style.display = "none"; });
document.getElementById("salvarValoresServicos").addEventListener("click", async () => {
  if (!catalogoItens.length) return alert("Adicione pelo menos um item antes de salvar o catálogo.");
  atualizarMapaCatalogo();
  const novosPrecos = Object.fromEntries(catalogoItens.map((item) => [item.nome, Number(item.valor) || 0]));
  const botao = document.getElementById("salvarValoresServicos");
  botao.disabled = true;
  try {
    await setDoc(valoresServicosRef, { precos: novosPrecos, catalogo: catalogoItens }, { merge: true });
    const pendentes = atualizarPendenciasTempoMedio();
    if (pendentes.length) {
      alert(`Catálogo salvo, mas ainda faltam tempos médios em ${pendentes.length} item(ns). Complete o cadastro para concluir esta pendência.`);
    } else {
      alert("Catálogo salvo com os tempos médios. As informações já aparecem no site, no chat e nos novos agendamentos.");
      modalValoresServicos.style.display = "none";
    }
  } catch (e) {
    console.error("Erro ao salvar valores dos procedimentos:", e);
    alert("Não foi possível salvar os valores. Verifique a conexão e as permissões do Firebase.");
  } finally {
    botao.disabled = false;
  }
});
window.addEventListener("click", (e) => {
  if (e.target === modalValoresServicos) modalValoresServicos.style.display = "none";
});

const campoProcedimentoManual = document.getElementById("procedimentoManual");
const campoValorManual = document.getElementById("valorManual");
const catalogoManual = document.getElementById("procedimentosCatalogo");
if (catalogoManual) {
  catalogoManual.innerHTML = "";
  Object.keys(catalogoProcedimentos).forEach((nome) => {
    const option = document.createElement("option");
    option.value = nome;
    catalogoManual.appendChild(option);
  });
}
if (campoProcedimentoManual && campoValorManual) {
  campoProcedimentoManual.addEventListener("input", () => {
    const valor = catalogoProcedimentos[campoProcedimentoManual.value];
    if (valor !== undefined) campoValorManual.value = valor;
    const tempo = tempoMedioDoProcedimento(campoProcedimentoManual.value);
    const aviso = document.getElementById("tempoMedioManual");
    if (aviso) aviso.textContent = tempo > 0 ? `Tempo médio: ${formatarTempoMedio(tempo)}` : "Tempo médio não cadastrado no catálogo";
  });
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
  if (user && !user.email) {
    // A sessão por SMS da área da cliente não concede acesso ao painel.
    signOut(auth);
    adminContainer.style.display = "none";
    loginContainer.style.display = "flex";
    return;
  }
  if (user?.email) {
    loginContainer.style.display = "none";
    adminContainer.style.display = "block";
    criarFiltros();
    carregarAgendamentos();
    carregarDespesas();
    verificarAniversariantesHoje();
    setTimeout(() => verificarReagendamentosPendentes(true), 1800);
    setTimeout(async () => {
      try {
        await carregarCatalogoPrecosAdmin();
        const pendentesTempo = atualizarPendenciasTempoMedio();
        carregarAgendamentos();
        if (pendentesTempo.length) {
          renderizarEditorPrecos();
          modalValoresServicos.style.display = "flex";
        }
      } catch (e) {
        console.error("Não foi possível verificar os tempos médios do catálogo:", e);
      }
    }, 900);
    setTimeout(verificarFinalizacoes, 4000);
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


// --- Navegação entre agenda e financeiro --- //
const adminTabs = [...document.querySelectorAll(".admin-tab")];
const adminPanels = [...document.querySelectorAll(".dashboard-panel")];

function ativarAbaAdmin(tabId) {
  adminTabs.forEach((tab) => {
    const ativa = tab.id === tabId;
    tab.setAttribute("aria-selected", String(ativa));
    tab.tabIndex = ativa ? 0 : -1;
    tab.classList.toggle("is-active", ativa);
  });

  adminPanels.forEach((panel) => {
    panel.hidden = panel.getAttribute("aria-labelledby") !== tabId;
  });
}

adminTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => ativarAbaAdmin(tab.id));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? adminTabs.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + adminTabs.length) % adminTabs.length;
    adminTabs[nextIndex].focus();
    ativarAbaAdmin(adminTabs[nextIndex].id);
  });
});
ativarAbaAdmin("tabAgendamentos");
// --- Criar filtros de mês e dia --- //
// Meses do filtro: por padrão, do mês atual até 12 meses à frente.
// Os meses anteriores só aparecem se a opção "Mostrar meses anteriores" for marcada.
const nomesMesesFiltro = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
let mostrarMesesAnteriores = false;

function mesesFiltro() {
  const lista = [];
  const hoje = new Date();
  const inicio = mostrarMesesAnteriores ? new Date(2025, 10, 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 1);
  for (let d = inicio; d <= fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    lista.push({
      nome: `${nomesMesesFiltro[d.getMonth()]} ${d.getFullYear()}`,
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    });
  }
  return lista;
}

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

  const popularMesesFiltro = () => {
    const anterior = selectMes.value;
    selectMes.innerHTML = "";
    mesesFiltro().forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.mes;
      opt.textContent = m.nome;
      selectMes.appendChild(opt);
    });
    if ([...selectMes.options].some(o => o.value === anterior)) selectMes.value = anterior;
    else selectMes.value = mesAtualYM();
  };
  popularMesesFiltro();

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
  btnTodosMeses.textContent = "📅 Mês atual em diante";
  btnTodosMeses.className = "btnSecundario";
  btnTodosMeses.onclick = () => {
    filtroMesAtual = "todos";
    inputDia.value = "";
    carregarAgendamentos();
    carregarDespesas();
  };

  const lblAnteriores = document.createElement("label");
  lblAnteriores.style.cssText = "display:flex;align-items:center;gap:6px;font-size:.85rem;color:var(--text-soft);cursor:pointer";
  const chkAnteriores = document.createElement("input");
  chkAnteriores.type = "checkbox";
  chkAnteriores.id = "chkMesesAnteriores";
  chkAnteriores.onchange = () => {
    mostrarMesesAnteriores = chkAnteriores.checked;
    popularMesesFiltro();
    carregarAgendamentos();
    carregarDespesas();
  };
  lblAnteriores.append(chkAnteriores, " Mostrar meses anteriores");

  filtrosContainer.append(selectMes, inputDia, btnFiltrar, btnTodosMeses, lblAnteriores);
  adminContainer.insertBefore(filtrosContainer, adminContainer.querySelector(".admin-tabs") || adminContainer.querySelector(".panel-title"));

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
async function adicionarHorarioOcupado(data, horario, agendamentoId) {
  if (!data || !horario) return "";
  try {
    const ocupacao = await addDoc(collection(db, "horariosOcupados"), { data, horario, ...(agendamentoId ? { agendamentoId } : {}) });
    return ocupacao.id;
  } catch (e) {
    console.error("Erro ao registrar horário ocupado:", e);
    return "";
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
  if (btn) btn.innerHTML = `<i class="fa-solid fa-circle-dollar-to-slot"></i> Sinais${pendentes > 0 ? ` <span class="toolbar-count">${pendentes}</span>` : ""}`;
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

// --- Aniversários --- //
const NOMES_MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Aceita "15/03", "15/3", "15-03", "15/03/1990"... Retorna { dia, mes } ou null
function parseAniversario(txt) {
  const m = String(txt ?? "").match(/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
  if (!m) return null;
  const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return { dia, mes };
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function msgAniversario(nome) {
  return (
`Olá ${nome || "Maravilhosa"}! 🎂✨

Passando para te desejar um feliz aniversário! 🎉💖
Que o seu mês seja cheio de beleza, alegria e muitas realizações.

Um carinho especial da Ana Luiza Fernandes Makeup! 🥰💄`
  );
}

async function buscarTodosAgendamentos() {
  const snap = await getDocs(collection(db, "agendamentos"));
  const lista = [];
  snap.forEach((d) => lista.push({ ...d.data(), id: d.id }));
  return lista;
}

const modalAniversarios = document.getElementById("modalAniversarios");
const listaAniversarios = document.getElementById("listaAniversarios");
const selectMesAniversario = document.getElementById("selectMesAniversario");
let cacheAniversarios = [];

function renderAniversariantes(mes) {
  const hoje = new Date();
  const hojeDia = hoje.getDate(), hojeMes = hoje.getMonth() + 1;

  // Uma entrada por cliente (telefone ou nome), guardando o atendimento mais recente
  const clientes = new Map();
  cacheAniversarios.forEach((ag) => {
    const niver = parseAniversario(ag.aniversario);
    if (!niver || niver.mes !== mes) return;
    const chave = (ag.telefone || "").replace(/\D/g, "") || (ag.nome || "").trim().toLowerCase();
    if (!chave) return;
    const atual = clientes.get(chave);
    if (!atual || (ag.data || "") > (atual.ultimaData || "")) {
      clientes.set(chave, {
        nome: ag.nome, telefone: ag.telefone, instagram: ag.instagram,
        dia: niver.dia, ultimaData: ag.data
      });
    }
  });

  const lista = [...clientes.values()].sort((a, b) => a.dia - b.dia);
  listaAniversarios.innerHTML = "";

  if (!lista.length) {
    listaAniversarios.innerHTML = `<p class="sinal-vazio">Nenhuma aniversariante em ${NOMES_MESES[mes - 1]}.</p>`;
    return;
  }

  lista.forEach((c) => {
    const ehHoje = mes === hojeMes && c.dia === hojeDia;
    const dataTxt = `${String(c.dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
    const card = document.createElement("div");
    card.className = "sinal-card" + (ehHoje ? " aniv-hoje" : "");
    card.innerHTML = `
      <div class="sinal-topo">
        <span class="sinal-nome">${esc(c.nome) || "-"}</span>
        <span class="sinal-status aniv">🎂 ${dataTxt}${ehHoje ? " · É hoje! 🎉" : ""}</span>
      </div>
      <div class="sinal-info">
        📞 ${esc(c.telefone) || "-"}
        ${c.instagram && c.instagram !== "Não informado" ? `<br>📸 ${esc(c.instagram)}` : ""}
        <br>📅 Último atendimento registrado: ${c.ultimaData ? c.ultimaData.split("-").reverse().join("/") : "-"}
      </div>
      <div class="sinal-acoes"></div>
    `;
    const btn = document.createElement("button");
    btn.className = "btnPrimario";
    btn.textContent = "💬 Parabenizar no WhatsApp";
    btn.onclick = () => {
      if (!(c.telefone || "").replace(/\D/g, "")) return alert("Telefone não informado!");
      abrirWhatsApp(c.telefone, msgAniversario(c.nome));
    };
    card.querySelector(".sinal-acoes").appendChild(btn);
    listaAniversarios.appendChild(card);
  });
}

async function abrirModalAniversarios() {
  if (!selectMesAniversario.options.length) {
    NOMES_MESES.forEach((nome, i) => {
      const opt = document.createElement("option");
      opt.value = i + 1;
      opt.textContent = nome;
      selectMesAniversario.appendChild(opt);
    });
  }
  selectMesAniversario.value = new Date().getMonth() + 1;
  listaAniversarios.innerHTML = `<p class="sinal-vazio">Carregando...</p>`;
  modalAniversarios.style.display = "flex";
  try {
    cacheAniversarios = await buscarTodosAgendamentos();
  } catch (e) {
    listaAniversarios.innerHTML = `<p class="sinal-vazio">Erro ao carregar: ${esc(e?.message || e)}</p>`;
    return;
  }
  renderAniversariantes(parseInt(selectMesAniversario.value, 10));
}

const btnAniversarios = document.getElementById("btnAniversarios");
if (btnAniversarios) {
  btnAniversarios.addEventListener("click", abrirModalAniversarios);
  selectMesAniversario.addEventListener("change", () => renderAniversariantes(parseInt(selectMesAniversario.value, 10)));
  document.getElementById("fecharAniversarios").addEventListener("click", () => modalAniversarios.style.display = "none");
  window.addEventListener("click", (e) => { if (e.target === modalAniversarios) modalAniversarios.style.display = "none"; });
}

// Pop-up no dia do atendimento: clientes atendidas hoje que fazem aniversário neste mês
const modalAniversarioHoje = document.getElementById("modalAniversarioHoje");
const listaAniversarioHoje = document.getElementById("listaAniversarioHoje");

async function verificarAniversariantesHoje() {
  if (!modalAniversarioHoje) return;
  if (sessionStorage.getItem("avisoAniversarioHoje") === hojeISO()) return; // 1x por sessão/dia

  let todos;
  try {
    todos = await buscarTodosAgendamentos();
  } catch (e) {
    console.error("Erro ao verificar aniversariantes de hoje:", e);
    return;
  }

  const hoje = new Date();
  const hojeDia = hoje.getDate(), hojeMes = hoje.getMonth() + 1;
  const atendimentosHoje = todos
    .filter((ag) => ag.data === hojeISO())
    .map((ag) => ({ ag, niver: parseAniversario(ag.aniversario) }))
    .filter((x) => x.niver && x.niver.mes === hojeMes)
    .sort((a, b) => (a.ag.horario || "").localeCompare(b.ag.horario || ""));

  if (!atendimentosHoje.length) return;
  sessionStorage.setItem("avisoAniversarioHoje", hojeISO());

  listaAniversarioHoje.innerHTML = "";
  atendimentosHoje.forEach(({ ag, niver }) => {
    const ehHoje = niver.dia === hojeDia;
    const dataTxt = `${String(niver.dia).padStart(2, "0")}/${String(niver.mes).padStart(2, "0")}`;
    const situacao = ehHoje ? "É hoje! 🎉" : niver.dia > hojeDia ? "Ainda este mês" : "Já passou neste mês";
    const card = document.createElement("div");
    card.className = "sinal-card aniv-hoje";
    card.innerHTML = `
      <div class="sinal-topo">
        <span class="sinal-nome">${esc(ag.nome) || "-"}</span>
        <span class="sinal-status aniv">🎂 ${dataTxt} · ${situacao}</span>
      </div>
      <div class="sinal-info">
        ⏰ Atendimento às ${esc(ag.horario) || "-"} · 💄 ${esc(ag.procedimento) || "-"}
      </div>
      <div class="sinal-acoes"></div>
    `;
    const btn = document.createElement("button");
    btn.className = "btnPrimario";
    btn.textContent = "💬 Parabenizar no WhatsApp";
    btn.onclick = () => {
      if (!(ag.telefone || "").replace(/\D/g, "")) return alert("Telefone não informado!");
      abrirWhatsApp(ag.telefone, msgAniversario(ag.nome));
    };
    card.querySelector(".sinal-acoes").appendChild(btn);
    listaAniversarioHoje.appendChild(card);
  });
  modalAniversarioHoje.style.display = "flex";
}

if (modalAniversarioHoje) {
  const fecharHoje = () => { modalAniversarioHoje.style.display = "none"; };
  document.getElementById("fecharAniversarioHoje").addEventListener("click", fecharHoje);
  document.getElementById("entendiAniversarioHoje").addEventListener("click", fecharHoje);
  window.addEventListener("click", (e) => { if (e.target === modalAniversarioHoje) fecharHoje(); });
}

// --- Meta mensal --- //
const metaRef = doc(db, "configuracoes", "meta");
const btnMeta = document.getElementById("btnMeta");
const modalMeta = document.getElementById("modalMeta");
const selectMesMeta = document.getElementById("selectMesMeta");
let metaCfg = { padrao: 0, meses: {} };
let metaCfgCarregada = false;
let cacheMeta = [];
let graficoLinha = null;
let graficoBarras = null;

function mesAtualYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nomeMesYM(ym) {
  const [y, m] = ym.split("-").map(Number);
  return `${NOMES_MESES[m - 1]} ${y}`;
}

function listarMesesYM(incluirAnteriores) {
  const lista = [];
  const hoje = new Date();
  const inicio = incluirAnteriores ? new Date(2025, 10, 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 12, 1);
  for (let d = inicio; d <= fim; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return lista;
}

async function carregarMetaCfg(forcar) {
  if (metaCfgCarregada && !forcar) return;
  try {
    const snap = await getDoc(metaRef);
    const d = snap.exists() ? snap.data() : {};
    metaCfg = { padrao: Number(d.padrao) || 0, meses: d.meses || {} };
    metaCfgCarregada = true;
  } catch (e) {
    console.error("Erro ao carregar meta:", e);
  }
}

function metaDoMes(ym) {
  const v = Number(metaCfg.meses?.[ym]);
  return v > 0 ? v : (Number(metaCfg.padrao) || 0);
}

function valorFinalAg(ag) {
  return Math.max(Number(ag.valor || 0) - Number(ag.desconto || 0), 0);
}

// Reservas com prazo vencido e sem pagamento não contam para a meta
function contaNaMeta(ag) {
  if (ag.sinalValor && ag.sinalStatus === "aguardando" && tempoRestante(ag.sinalPrazo).expirado) return false;
  return true;
}

function calcularMeta(ags, ym) {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const atual = mesAtualYM();
  const status = ym === atual ? "atual" : (ym < atual ? "passado" : "futuro");
  const hojeDia = status === "atual" ? new Date().getDate() : (status === "passado" ? lastDay : 0);

  const realDia = new Array(lastDay).fill(0);
  const projDia = new Array(lastDay).fill(0);
  let realizado = 0, projetado = 0, qtdConcl = 0, qtdTotal = 0;

  ags.forEach((ag) => {
    if (!ag.data || ag.data.slice(0, 7) !== ym || !contaNaMeta(ag)) return;
    const v = valorFinalAg(ag);
    const dia = parseInt(ag.data.slice(8, 10), 10);
    if (!(dia >= 1 && dia <= lastDay)) return;
    projetado += v; qtdTotal++; projDia[dia - 1] += v;
    if (ag.concluido === true) { realizado += v; qtdConcl++; realDia[dia - 1] += v; }
  });

  const meta = metaDoMes(ym);
  const aRealizar = projetado - realizado;
  const ticket = qtdTotal ? projetado / qtdTotal : 0;
  const faltaProj = Math.max(meta - projetado, 0);
  const diasRestantes = status === "atual" ? lastDay - hojeDia + 1 : (status === "futuro" ? lastDay : 0);

  let acR = 0, acP = 0;
  const acumReal = realDia.map((v, i) => { acR += v; return i + 1 <= hojeDia ? acR : null; });
  const acumProj = projDia.map((v) => (acP += v));

  return {
    ym, status, lastDay, hojeDia, meta, realizado, aRealizar, projetado, qtdConcl, qtdTotal, ticket,
    pct: meta ? (realizado / meta) * 100 : 0,
    pctProj: meta ? (projetado / meta) * 100 : 0,
    falta: Math.max(meta - realizado, 0),
    faltaProj, diasRestantes,
    porDia: diasRestantes > 0 ? Math.max(meta - realizado, 0) / diasRestantes : 0,
    atendFaltam: ticket > 0 ? Math.ceil(faltaProj / ticket) : 0,
    acumReal, acumProj
  };
}

function mensagemMeta(c) {
  const pick = (arr) => arr[new Date().getDate() % arr.length];
  if (!c.meta) {
    return pick([
      "✨ Defina a sua meta do mês e acompanhe cada passo da sua evolução. Metas dão direção — e você já mostra o quanto o seu trabalho encanta!",
      "🌱 Que tal escolher uma meta para este mês? Comece com um valor que te motive: o importante é ter um norte."
    ]);
  }
  if (c.pct >= 100) {
    return pick([
      "🏆 META BATIDA! Parabéns, Ana! Todo esse resultado vem do seu talento, da sua dedicação e do carinho com cada cliente. Comemore, você merece! 🥳",
      "🎉 Meta conquistada! Cada atendimento foi um passo até aqui. Aproveite o momento e sinta orgulho de você! 💖",
      "👑 Você bateu a meta! O seu trabalho é a prova de que dedicação traz resultado. Que venha ainda mais! ✨"
    ]);
  }
  if (c.status === "passado") {
    return c.pctProj >= 100
      ? "✅ Mês encerrado com a meta atingida. Parabéns pelo resultado, Ana! 💖"
      : pick([
        `🌷 Este mês fechou em ${c.pct.toFixed(0)}% da meta. Cada mês traz um aprendizado — olhe para o que funcionou e leve isso para o próximo. Você está construindo algo lindo!`,
        `💛 Nem todo mês é igual, e tudo bem. Você fechou com ${brl(c.realizado)} e isso já é fruto do seu esforço. Respire fundo e vamos para o próximo!`
      ]);
  }
  if (c.status === "futuro") {
    return "🗓️ Esse mês ainda vai começar. Os agendamentos já registrados aparecem aqui, e a sua meta pode ser ajustada quando quiser. Bora planejar com carinho! ✨";
  }
  if (c.pctProj >= 100) {
    return pick([
      "📅 Os seus agendamentos já cobrem a meta! Agora é só realizar cada atendimento com o capricho de sempre. 💄",
      "🌟 Meta garantida nos agendamentos! Falta concluir os atendimentos — você está no caminho certo."
    ]);
  }
  const esperado = (c.hojeDia / c.lastDay) * 100;
  if (c.pct >= 90) {
    return pick([
      `🔥 Você está a um passo! Faltam só ${brl(c.falta)} para a meta. Respire fundo e finalize com força!`,
      `🚀 Quase lá, Ana! Falta pouquinho (${brl(c.falta)}). A reta final é sua!`
    ]);
  }
  if (c.pct >= esperado) {
    return pick([
      `💪 Você está no ritmo ou à frente! Já são ${c.pct.toFixed(0)}% da meta com ${c.hojeDia} dias de mês. Continue assim!`,
      "🌸 Seu mês está caminhando muito bem. Cada atendimento aproxima você da meta — siga com a mesma energia!"
    ]);
  }
  return pick([
    "🤍 O mês ainda não decolou, e está tudo bem. Ainda há dias pela frente, e cada cliente atendida com carinho faz diferença. Um passo de cada vez!",
    "🌻 Dias mais calmos fazem parte do caminho. Aproveite para divulgar nas redes, falar com clientes antigas e cuidar de você. O seu trabalho é de muito valor!",
    "✨ Confie no seu processo. A sua qualidade já conquistou muitas clientes, e novas virão. Vamos com calma e constância!"
  ]);
}

function infoFormMeta(ym) {
  const info = document.getElementById("metaInfoForm");
  const temEspecifica = Number(metaCfg.meses?.[ym]) > 0;
  info.textContent = `Meta padrão: ${metaCfg.padrao > 0 ? brl(metaCfg.padrao) : "não definida"}` +
    (temEspecifica ? ` · ${nomeMesYM(ym)} usa meta específica de ${brl(metaCfg.meses[ym])}` : "");
  document.getElementById("usarMetaPadrao").style.display = temEspecifica && metaCfg.padrao > 0 ? "inline-block" : "none";
  document.getElementById("metaValor").value = metaDoMes(ym) || "";
}

function renderMeta(ym) {
  const c = calcularMeta(cacheMeta, ym);
  const cont = document.getElementById("metaConteudo");
  infoFormMeta(ym);

  const barReal = c.meta ? Math.min(c.pct, 100) : 0;
  const barProj = c.meta ? Math.min(Math.max(c.pctProj - c.pct, 0), 100 - barReal) : 0;
  const acima = c.meta && c.realizado > c.meta ? c.realizado - c.meta : 0;

  const cards = [];
  cards.push(["🎯 Meta bruta", c.meta ? brl(c.meta) : "—", ""]);
  cards.push(["✅ Realizado (concluído)", brl(c.realizado), `${c.qtdConcl} atendimento(s)`]);
  cards.push(["📅 A concluir (agendado)", brl(c.aRealizar), `${c.qtdTotal - c.qtdConcl} atendimento(s)`]);
  cards.push(["📈 Projetado", brl(c.projetado), c.meta ? `${c.pctProj.toFixed(0)}% da meta` : ""]);
  if (c.meta) {
    cards.push([acima > 0 ? "🏅 Acima da meta" : "🧗 Falta para a meta", acima > 0 ? brl(acima) : brl(c.falta), "considerando só o concluído", "destaque"]);
    if (c.status !== "passado" && c.projetado < c.meta) cards.push(["🔮 Falta além dos agendados", brl(c.faltaProj), ""]);
  }
  cards.push(["🎟️ Ticket médio", brl(c.ticket), ""]);
  if (c.meta && c.status === "atual" && c.falta > 0) {
    cards.push(["📆 Por dia restante", brl(c.porDia), `${c.diasRestantes} dia(s) incluindo hoje`]);
    if (c.atendFaltam > 0) cards.push(["💄 Atendimentos que faltam", String(c.atendFaltam), "além dos já agendados"]);
  }

  cont.innerHTML = `
    <div>
      <div class="meta-pct">${c.meta ? c.pct.toFixed(0) + "%" : "—"}</div>
      <div class="meta-barra" aria-label="Progresso da meta">
        <div class="real" style="width:${barReal}%"></div>
        <div class="proj" style="width:${barProj}%"></div>
      </div>
      <div class="meta-legenda">
        <span><i style="background:var(--verde)"></i>Realizado</span>
        <span><i style="background:var(--dourado)"></i>Agendado a concluir</span>
        <span><i style="background:#eadfe0"></i>Falta</span>
      </div>
    </div>
    <div class="meta-msg">${mensagemMeta(c)}</div>
    <div class="meta-cards">
      ${cards.map(([rot, val, sub, cls]) => `
        <div class="meta-card ${cls || ""}"><small>${rot}</small><strong>${val}</strong>${sub ? `<small>${sub}</small>` : ""}</div>`).join("")}
    </div>
    <p class="meta-grafico-titulo">Evolução no mês</p>
    <div class="meta-grafico"><canvas id="graficoMetaLinha"></canvas></div>
    <p class="meta-grafico-titulo">Últimos 6 meses</p>
    <div class="meta-grafico"><canvas id="graficoMetaBarras"></canvas></div>
  `;
  desenharGraficosMeta(c);
}

function desenharGraficosMeta(c) {
  if (typeof Chart === "undefined") return;
  if (graficoLinha) graficoLinha.destroy();
  if (graficoBarras) graficoBarras.destroy();
  const verde = "#556b2f", dourado = "#d4af37", cinza = "#9a8f91";
  const fmt = (v) => "R$ " + Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const opcoes = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
    scales: { y: { beginAtZero: true, ticks: { callback: (v) => fmt(v) } } }
  };

  const dias = Array.from({ length: c.lastDay }, (_, i) => i + 1);
  const dsLinha = [
    { label: "Realizado", data: c.acumReal, borderColor: verde, backgroundColor: verde, tension: .25, spanGaps: false, pointRadius: 2 },
    { label: "Projetado (com agendados)", data: c.acumProj, borderColor: dourado, backgroundColor: dourado, borderDash: [6, 4], tension: .25, pointRadius: 0 }
  ];
  if (c.meta) {
    dsLinha.push({ label: "Ritmo ideal", data: dias.map((d) => (c.meta * d) / c.lastDay), borderColor: cinza, borderDash: [2, 4], pointRadius: 0 });
  }
  graficoLinha = new Chart(document.getElementById("graficoMetaLinha"), {
    type: "line", data: { labels: dias, datasets: dsLinha }, options: opcoes
  });

  // Últimos 6 meses terminando no mês selecionado
  const [y, m] = c.ym.split("-").map(Number);
  const rotulos = [], valores = [], metas = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    rotulos.push(`${NOMES_MESES[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(2)}`);
    valores.push(cacheMeta.filter((ag) => ag.data?.slice(0, 7) === ym && contaNaMeta(ag)).reduce((s, ag) => s + valorFinalAg(ag), 0));
    metas.push(metaDoMes(ym) || null);
  }
  graficoBarras = new Chart(document.getElementById("graficoMetaBarras"), {
    data: {
      labels: rotulos,
      datasets: [
        { type: "bar", label: "Bruto", data: valores, backgroundColor: verde, borderRadius: 6 },
        { type: "line", label: "Meta", data: metas, borderColor: dourado, backgroundColor: dourado, borderWidth: 2, pointRadius: 4, spanGaps: true }
      ]
    },
    options: opcoes
  });
}

async function atualizarBotaoMeta(ags) {
  if (!btnMeta) return;
  await carregarMetaCfg();
  const c = calcularMeta(ags, mesAtualYM());
  btnMeta.innerHTML = `<i class="fa-solid fa-chart-line"></i> Meta mensal${c.meta ? ` <span class="toolbar-count">${c.pct.toFixed(0)}%</span>` : ""}`;
}

function popularMesesMeta(incluirAnteriores) {
  const anterior = selectMesMeta.value;
  selectMesMeta.innerHTML = "";
  listarMesesYM(incluirAnteriores).forEach((ym) => {
    const opt = document.createElement("option");
    opt.value = ym;
    opt.textContent = nomeMesYM(ym);
    selectMesMeta.appendChild(opt);
  });
  selectMesMeta.value = [...selectMesMeta.options].some((o) => o.value === anterior) ? anterior : mesAtualYM();
}

async function abrirModalMeta() {
  modalMeta.style.display = "flex";
  document.getElementById("metaMostrarAnteriores").checked = false;
  popularMesesMeta(false);
  selectMesMeta.value = mesAtualYM();
  document.getElementById("metaConteudo").innerHTML = `<p class="sinal-vazio">Carregando...</p>`;
  try {
    await carregarMetaCfg(true);
    cacheMeta = await buscarTodosAgendamentos();
  } catch (e) {
    document.getElementById("metaConteudo").innerHTML = `<p class="sinal-vazio">Erro ao carregar: ${esc(e?.message || e)}</p>`;
    return;
  }
  renderMeta(selectMesMeta.value);
}

async function salvarMeta(tipo) {
  const ym = selectMesMeta.value;
  const v = parseFloat(document.getElementById("metaValor").value);
  if (!(v > 0)) return alert("Informe um valor de meta maior que zero.");
  try {
    if (tipo === "mes") {
      await setDoc(metaRef, { meses: { [ym]: v } }, { merge: true });
      metaCfg.meses = { ...(metaCfg.meses || {}), [ym]: v };
    } else {
      await setDoc(metaRef, { padrao: v }, { merge: true });
      metaCfg.padrao = v;
    }
  } catch (e) {
    console.error("Erro ao salvar meta:", e);
    return alert("⚠️ Erro ao salvar: " + (e?.message || e) + "\n\nVerifique as Regras de Segurança do Firestore para 'configuracoes/meta'.");
  }
  renderMeta(ym);
  atualizarBotaoMeta(cacheMeta);
}

if (btnMeta) {
  btnMeta.addEventListener("click", abrirModalMeta);
  selectMesMeta.addEventListener("change", () => renderMeta(selectMesMeta.value));
  document.getElementById("metaMostrarAnteriores").addEventListener("change", (e) => {
    popularMesesMeta(e.target.checked);
    renderMeta(selectMesMeta.value);
  });
  document.getElementById("salvarMetaMes").addEventListener("click", () => salvarMeta("mes"));
  document.getElementById("salvarMetaPadrao").addEventListener("click", () => salvarMeta("padrao"));
  document.getElementById("usarMetaPadrao").addEventListener("click", async () => {
    const ym = selectMesMeta.value;
    try {
      await setDoc(metaRef, { meses: { [ym]: deleteField() } }, { merge: true });
      delete metaCfg.meses[ym];
    } catch (e) {
      return alert("⚠️ Erro: " + (e?.message || e));
    }
    renderMeta(ym);
    atualizarBotaoMeta(cacheMeta);
  });
  document.getElementById("fecharMeta").addEventListener("click", () => modalMeta.style.display = "none");
  window.addEventListener("click", (e) => { if (e.target === modalMeta) modalMeta.style.display = "none"; });
}

// --- Finalização do atendimento --- //
// O pop-up aparece quando passam MINUTOS_APOS_HORARIO do horário marcado e o atendimento
// ainda não foi concluído. Considera os últimos 7 dias, para não avisar sobre dados muito antigos.
const MINUTOS_APOS_HORARIO = 60;
const modalFinalizacao = document.getElementById("modalFinalizacao");
const finalizacaoCorpo = document.getElementById("finalizacaoCorpo");
const finalizacaoContador = document.getElementById("finalizacaoContador");
let filaFinalizacao = [];
let finalizacaoAberta = false;
const adiadosFinalizacao = new Set();

function msgAgradecimento(nome) {
  return (
`Olá ${nome || "Maravilhosa"}! 💖✨

Muito obrigada por escolher a Ana Luiza Fernandes Makeup! Foi um prazer cuidar de você. 🥰

Espero que tenha amado o resultado! Se puder, me conta o que achou, e se quiser, marque o nosso Instagram: @analuizafernandesmakeup ✨

Já fico aguardando você para o próximo atendimento. Quando quiser agendar, é só me chamar ou usar o autoatendimento do site. 💄

Um beijo!`
  );
}

function msgAtrasoOuFalta(nome) {
  return (
`Olá ${nome || "Maravilhosa"}! 😊

O tempo máximo de espera é de 20 minutos. Como o atraso ultrapassou esse período, não conseguirei mais realizar seu atendimento hoje. Podemos remarcar novamente em um dia que você esteja com tempo?`
  );
}

function msgRemarcar(nome) {
  return (
`Olá ${nome || "Maravilhosa"}! 💕

Não conseguimos realizar o seu atendimento no horário marcado. Vamos remarcar para um dia que fique bom para você? Me conta qual dia e período são melhores. 😊`
  );
}

function fimDoAtendimento(ag) {
  const [y, m, d] = (ag.data || "").split("-").map(Number);
  const [h, mi] = (ag.horario || "").split(":").map(Number);
  if (isNaN(h) || isNaN(mi)) return new Date(y, m - 1, d, 23, 59);
  return new Date(y, m - 1, d, h, mi + MINUTOS_APOS_HORARIO);
}

function algumModalAberto() {
  return [...document.querySelectorAll(".modal")].some((m) => m.style.display === "flex");
}

async function verificarFinalizacoes() {
  if (!auth.currentUser || !modalFinalizacao || finalizacaoAberta || algumModalAberto()) return;

  const desde = new Date();
  desde.setDate(desde.getDate() - 7);
  const desdeISO = `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, "0")}-${String(desde.getDate()).padStart(2, "0")}`;

  let docs;
  try {
    const snap = await getDocs(query(collection(db, "agendamentos"), where("data", ">=", desdeISO)));
    docs = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch (e) {
    console.error("Erro ao verificar finalizações:", e);
    return;
  }

  const agora = new Date();
  filaFinalizacao = docs
    .filter((ag) => ag.concluido !== true && !ag.finalizacaoStatus && !ag.reagendamentoPendente && !adiadosFinalizacao.has(ag.id) && contaNaMeta(ag))
    .map((ag) => ({ ag, fim: fimDoAtendimento(ag) }))
    .filter((x) => x.fim <= agora)
    .sort((a, b) => a.fim - b.fim)
    .map((x) => x.ag);

  if (!filaFinalizacao.length || algumModalAberto()) return;
  finalizacaoAberta = true;
  modalFinalizacao.style.display = "flex";
  renderFinalizacao("pergunta");
}

function fecharFinalizacao(adiar) {
  if (adiar) filaFinalizacao.forEach((ag) => adiadosFinalizacao.add(ag.id));
  filaFinalizacao = [];
  finalizacaoAberta = false;
  modalFinalizacao.style.display = "none";
  carregarAgendamentos();
}

function proximaFinalizacao() {
  filaFinalizacao.shift();
  if (!filaFinalizacao.length) return fecharFinalizacao(false);
  renderFinalizacao("pergunta");
}

function botaoFin(texto, classe, onclick) {
  const b = document.createElement("button");
  b.className = classe;
  b.textContent = texto;
  b.onclick = onclick;
  return b;
}

function renderFinalizacao(etapa) {
  const ag = filaFinalizacao[0];
  if (!ag) return fecharFinalizacao(false);

  const dataBr = ag.data ? ag.data.split("-").reverse().join("/") : "-";
  const total = valorFinalAg(ag);
  const aReceber = ag.sinalValor && ag.sinalStatus === "pago" ? Math.max(total - Number(ag.sinalValor), 0) : total;
  finalizacaoContador.textContent = filaFinalizacao.length > 1
    ? `${filaFinalizacao.length} atendimentos aguardando finalização.`
    : "1 atendimento aguardando finalização.";

  finalizacaoCorpo.innerHTML = "";
  const card = document.createElement("div");
  card.className = "sinal-card";
  card.innerHTML = `
    <div class="sinal-topo">
      <span class="sinal-nome">${esc(ag.nome) || "-"}</span>
      <span class="sinal-status">📅 ${dataBr} às ${esc(ag.horario) || "-"}</span>
    </div>
    <div class="sinal-info">
      📞 ${esc(ag.telefone) || "-"}<br>
      💄 ${esc(ag.procedimento) || "-"}<br>
      💰 Total: <strong>${brl(total)}</strong>
      ${ag.sinalValor ? ` · Reserva: ${brl(ag.sinalValor)} (${ag.sinalStatus === "pago" ? "paga" : "NÃO confirmada"})` : ""}
      · A receber: <strong>${brl(aReceber)}</strong>
    </div>`;
  finalizacaoCorpo.appendChild(card);

  const pergunta = document.createElement("p");
  pergunta.style.cssText = "margin:10px 0 6px;font-weight:600;color:var(--verde)";
  const acoes = document.createElement("div");
  acoes.className = "sinal-acoes";

  if (etapa === "pergunta") {
    pergunta.textContent = "O procedimento foi realizado?";
    acoes.append(
      botaoFin("✅ Sim, foi realizado", "btnPrimario", async () => {
        try {
          await updateDoc(doc(db, "agendamentos", ag.id), {
            concluido: true, finalizacaoStatus: "realizado", concluidoEm: new Date().toISOString()
          });
        } catch (e) { return alert("⚠️ Erro ao finalizar: " + (e?.message || e)); }
        renderFinalizacao("agradecimento");
      }),
      botaoFin("❌ Não foi realizado", "btnPerigo", async () => {
        try {
          await updateDoc(doc(db, "agendamentos", ag.id), { finalizacaoStatus: "nao_realizado" });
        } catch (e) { return alert("⚠️ Erro ao registrar: " + (e?.message || e)); }
        renderFinalizacao("nao_realizado");
      }),
      botaoFin("⏳ Decidir depois", "btnFechar", () => {
        adiadosFinalizacao.add(ag.id);
        proximaFinalizacao();
      })
    );
  } else if (etapa === "agradecimento") {
    pergunta.textContent = "🎉 Atendimento concluído! Parabéns, Ana! Deseja enviar uma mensagem de agradecimento para a cliente?";
    acoes.append(
      botaoFin("💬 Enviar agradecimento no WhatsApp", "btnPrimario", () => {
        if (!(ag.telefone || "").replace(/\D/g, "")) { alert("Telefone não informado!"); return; }
        abrirWhatsApp(ag.telefone, msgAgradecimento(ag.nome));
        updateDoc(doc(db, "agendamentos", ag.id), { agradecimentoEnviadoEm: new Date().toISOString() }).catch(() => {});
        proximaFinalizacao();
      }),
      botaoFin("Agora não", "btnFechar", proximaFinalizacao)
    );
  } else if (etapa === "nao_realizado") {
    pergunta.textContent = "Registrado como não realizado. Deseja avisar a cliente?";
    acoes.append(
      botaoFin("⏰ Avisar atraso (20 min)", "btnSecundario", () => {
        if (!(ag.telefone || "").replace(/\D/g, "")) { alert("Telefone não informado!"); return; }
        abrirWhatsApp(ag.telefone, msgAtrasoOuFalta(ag.nome));
        proximaFinalizacao();
      }),
      botaoFin("🔁 Propor remarcação", "btnSecundario", () => {
        if (!(ag.telefone || "").replace(/\D/g, "")) { alert("Telefone não informado!"); return; }
        abrirWhatsApp(ag.telefone, msgRemarcar(ag.nome));
        proximaFinalizacao();
      }),
      botaoFin("Só registrar", "btnFechar", proximaFinalizacao)
    );
  }
  finalizacaoCorpo.append(pergunta, acoes);
}

if (modalFinalizacao) {
  document.getElementById("fecharFinalizacao").addEventListener("click", () => fecharFinalizacao(true));
  window.addEventListener("click", (e) => { if (e.target === modalFinalizacao) fecharFinalizacao(true); });
  // Reverifica a cada 5 minutos enquanto o painel estiver aberto e visível
  setInterval(() => { if (!document.hidden) verificarFinalizacoes(); }, 300000);
}

// --- Carregar agendamentos --- //
function normalizarDataAgenda(data) {
  const texto = String(data || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const brasileira = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return brasileira ? `${brasileira[3]}-${brasileira[2]}-${brasileira[1]}` : "";
}

async function sincronizarHorariosOcupados(agendamentosSnapshot) {
  try {
    const ocupacoesSnapshot = await getDocs(collection(db, "horariosOcupados"));
    const chavesOcupadas = new Set();
    const ocupacaoPorChave = new Map();
    ocupacoesSnapshot.forEach((item) => {
      const ocupacao = item.data();
      const data = normalizarDataAgenda(ocupacao.data);
      const horario = String(ocupacao.horario || "").trim();
      if (data && horario) {
        const chave = `${data}|${horario}`;
        chavesOcupadas.add(chave);
        if (!ocupacaoPorChave.has(chave)) ocupacaoPorChave.set(chave, item);
      }
    });

    const pendentes = [];
    agendamentosSnapshot.forEach((item) => {
      const agendamento = item.data();
      const telefoneBusca = String(agendamento.telefone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (telefoneBusca && agendamento.telefoneBusca !== telefoneBusca) {
        pendentes.push(updateDoc(doc(db, "agendamentos", item.id), { telefoneBusca }));
      }
      if (agendamento.canceladoCliente) return;
      const data = normalizarDataAgenda(agendamento.data);
      const horario = String(agendamento.horario || "").trim();
      if (!data || !horario) return;
      const chave = `${data}|${horario}`;
      if (chavesOcupadas.has(chave)) {
        const ocupacaoExistente = ocupacaoPorChave.get(chave);
        if (ocupacaoExistente && !ocupacaoExistente.data().agendamentoId) {
          pendentes.push(updateDoc(doc(db, "horariosOcupados", ocupacaoExistente.id), { agendamentoId: item.id }));
        }
        return;
      }

      // Usa um documento independente para nunca sobrescrever uma reserva
      // criada simultaneamente pelo chatbot.
      pendentes.push(addDoc(collection(db, "horariosOcupados"), {
        data,
        horario,
        agendamentoId: item.id
      }));
      chavesOcupadas.add(chave);
    });
    await Promise.all(pendentes);

    // Public lookup mirror: clients can fetch one phone-specific document only.
    // This keeps the appointment collection private and needs no Cloud Functions.
    const consultas = new Map();
    agendamentosSnapshot.forEach((item) => {
      const ag = item.data();
      const telefoneBusca = String(ag.telefoneBusca || ag.telefone || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (!/^\d{10,11}$/.test(telefoneBusca)) return;
      const nome = String(ag.nome || "").trim();
      const nomeBusca = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
      const nomeKey = nomeBusca.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
      if (!nomeKey) return;
      const consultaId = `${telefoneBusca}_${nomeKey}`;
      if (!consultas.has(consultaId)) consultas.set(consultaId, { telefoneBusca, nomeBusca, agendamentos: [] });
      consultas.get(consultaId).agendamentos.push({
        id: item.id,
        nome,
        nomeBusca,
        data: ag.data || "",
        horario: ag.horario || "",
        periodo: ag.periodo || "",
        procedimento: ag.procedimento || "",
        canceladoCliente: ag.canceladoCliente === true
      });
    });
    consultas.forEach((consulta) => consulta.agendamentos.sort((a, b) => normalizarDataAgenda(a.data).localeCompare(normalizarDataAgenda(b.data))));
    const espelhoAtual = await getDocs(collection(db, "consultasCliente"));
    const espelhoPorTelefone = new Map(espelhoAtual.docs.map((item) => [item.id, item]));
    const tarefasEspelho = [];
    consultas.forEach((consulta, consultaId) => {
      const existente = espelhoPorTelefone.get(consultaId)?.data();
      espelhoPorTelefone.delete(consultaId);
      if (existente && JSON.stringify(existente.agendamentos || []) === JSON.stringify(consulta.agendamentos)) return;
      tarefasEspelho.push(setDoc(doc(db, "consultasCliente", consultaId), { ...consulta, atualizadoEm: new Date().toISOString() }));
    });
    espelhoPorTelefone.forEach((item) => tarefasEspelho.push(deleteDoc(doc(db, "consultasCliente", item.id))));
    await Promise.all(tarefasEspelho);
  } catch (e) {
    // A visualização do painel continua disponível; registramos o erro para
    // diagnosticar regras ou conexão e tentar novamente na próxima carga.
    console.error("Não foi possível sincronizar os horários ocupados:", e);
  }
}

async function carregarAgendamentos() {
  const querySnapshot = await getDocs(collection(db, "agendamentos"));
  // Mantém a agenda pública de horários ocupados compatível com agendamentos
  // antigos que foram criados antes da sincronização automática do chatbot.
  await sincronizarHorariosOcupados(querySnapshot);
  tabelaAgendamentos.innerHTML = "";

  const filtroMes = filtroMesAtual;
  const filtroDia = document.getElementById("filtroDia")?.value || "";

  let agendamentos = [];
  querySnapshot.forEach((docSnap) => {
    const ag = docSnap.data();
    if (!ag.data || ag.canceladoCliente) return;
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
  atualizarBotaoMeta(agendamentos);

  let totalBruto = 0;
  let totalDescontos = 0;
  let pagamentos = {};
  let contador = 0;

  agendamentos.forEach((ag) => {
    const dataBase = ag.data.slice(0, 7);
    if (filtroMes !== "todos" && dataBase !== filtroMes) return;
    if (filtroMes === "todos" && !filtroDia && !mostrarMesesAnteriores && dataBase < mesAtualYM()) return;
    if (filtroDia && ag.data !== filtroDia) return;

    const valor = Number(ag.valor || 0);
    const desconto = Number(ag.desconto || 0);
    const valorFinal = Math.max(valor - desconto, 0);
    const concluido = ag.concluido === true;

    contador++;
    totalBruto += valor;
    totalDescontos += desconto;
    if (ag.formaPagamento)
      pagamentos[ag.formaPagamento] = (pagamentos[ag.formaPagamento] || 0) + valorFinal;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Cliente"><strong>${esc(ag.nome) || "-"}</strong><span class="appointment-detail">${esc(ag.telefone) || "-"}${ag.aniversario && ag.aniversario !== "Não informado" ? ` · Aniversário: ${esc(ag.aniversario)}` : ""}</span></td>
      <td data-label="Data e horário"><strong>${ag.data ? ag.data.split("-").reverse().join("/") : "-"}</strong><span class="appointment-detail">${esc(ag.periodo) || "-"} · ${esc(ag.horario) || "-"}</span>${(Number(ag.tempoMedioMinutos) || tempoMedioDoProcedimento(ag.procedimento)) > 0 ? `<span class="appointment-detail"><i class="fa-regular fa-clock" aria-hidden="true"></i> ${formatarTempoMedio(Number(ag.tempoMedioMinutos) || tempoMedioDoProcedimento(ag.procedimento))}</span>` : ""}${ag.solicitacaoCliente ? `<span class="appointment-client-request">Pedido da cliente: ${esc(ag.solicitacaoCliente.tipo === "cancelamento" ? "cancelamento" : `reagendamento para ${ag.solicitacaoCliente.data || "data a combinar"} às ${ag.solicitacaoCliente.horario || "horário a combinar"}`)}</span>` : ""}</td>
      <td data-label="Procedimento">${esc(ag.procedimento) || "-"}</td>
      <td data-label="Pagamento"><strong>${esc(ag.formaPagamento) || "-"}</strong><span class="appointment-detail">Sinal: ${sinalBadge(ag)}</span></td>
      <td data-label="Valores"><span class="appointment-amount"><span>Bruto: ${brl(valor)}</span>${desconto > 0 ? `<span class="discount">Desconto: ${brl(desconto)}</span>` : ""}<strong class="final">Final: ${brl(valorFinal)}</strong></span></td>
      <td data-label="Status"><span class="appointment-status"><input type="checkbox" class="chkConcluir" data-id="${ag.id}" ${concluido ? "checked" : ""}><label>${concluido ? "Concluído" : "Pendente"}</label></span></td>
      <td data-label="Ações">
        <button class="btnAcoes"
          data-id="${ag.id}"
          data-tel="${esc(ag.telefone)}"
          data-nome="${esc(ag.nome)}"
          data-data="${esc(ag.data)}"
          data-periodo="${esc(ag.periodo)}"
          data-horario="${esc(ag.horario)}"
          data-procedimento="${esc(ag.procedimento)}"
          data-valor="${valorFinal.toFixed(2)}"
          data-valorbruto="${valor.toFixed(2)}"
          data-desconto="${desconto.toFixed(2)}"
          data-reagendamentopendente="${Boolean(ag.reagendamentoPendente)}">
          <i class="fa-solid fa-sliders" aria-hidden="true"></i>
          <span>Ações</span>
          <i class="fa-solid fa-chevron-down btnAcoes-chevron" aria-hidden="true"></i>
        </button>
        ${ag.solicitacaoCliente ? `<button type="button" class="btnResolverSolicitacao" data-id="${ag.id}">Pedido tratado</button>` : ""}
      </td>
    `;
    tabelaAgendamentos.appendChild(tr);
    const btnResolverPedido = tr.querySelector(".btnResolverSolicitacao");
    if (btnResolverPedido) btnResolverPedido.onclick = async () => {
      if (!confirm("Confirma que o pedido da cliente já foi tratado?")) return;
      btnResolverPedido.disabled = true;
      try {
        await updateDoc(doc(db, "agendamentos", ag.id), { solicitacaoCliente: deleteField() });
        await carregarAgendamentos();
      } catch (erro) {
        console.error("Não foi possível concluir o pedido da cliente:", erro);
        alert("Não foi possível atualizar o pedido. Tente novamente.");
        btnResolverPedido.disabled = false;
      }
    };
  });

  totalAgendamentos.innerHTML = `<span>Atendimentos</span><strong>${contador}</strong>`;
  valorTotal.innerHTML = `<span>Faturamento bruto</span><strong>${brl(totalBruto)}</strong>`;
  totalBrutoGlobal = totalBruto;
  totalDescontosGlobal = totalDescontos;
  const percentualDesconto = totalBruto > 0 ? (totalDescontos / totalBruto) * 100 : 0;
  if (valorDescontosEl) valorDescontosEl.innerHTML = `<span>Descontos concedidos</span><strong>${brl(totalDescontos)}</strong><small>${percentualDesconto.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do faturamento</small>`;
  atualizarResumoLiquido();

  let resumoHTML = "<h4>Formas de Pagamento:</h4><ul>";
  for (const [forma, valor] of Object.entries(pagamentos))
    resumoHTML += `<li><span>${forma}</span><strong>${brl(valor)}</strong></li>`;
  resumoHTML += "</ul>";
  pagamentosResumo.innerHTML = resumoHTML;

  document.querySelectorAll(".chkConcluir").forEach((chk) => {
    chk.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const concluido = e.target.checked;
      const statusLabel = e.target.closest(".appointment-status")?.querySelector("label");
      if (statusLabel) statusLabel.textContent = concluido ? "Concluído" : "Pendente";
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
    if (filtroMes === "todos" && !filtroDia && !mostrarMesesAnteriores && dataBase < mesAtualYM()) return;
    if (filtroDia && d.data !== filtroDia) return;

    const valor = Number(d.valor || 0);
    totalDespesas += valor;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.nome || "-"}</td>
      <td>${d.data ? d.data.split("-").reverse().join("/") : "-"}</td>
      <td>${d.descricao || "-"}</td>
      <td>${d.formaPagamento || "-"}</td>
      <td>${brl(valor)}</td>
      <td>
        <button class="btnPerigo btnExcluirDespesa" data-id="${d.id}">🗑️ Excluir</button>
      </td>
    `;
    tabelaDespesas.appendChild(tr);
  });

  if (valorDespesasEl) valorDespesasEl.innerHTML = `<span>Despesas registradas</span><strong>${brl(totalDespesas)}</strong>`;
  const despesasTotalInline = document.getElementById("despesasTotalInline");
  if (despesasTotalInline) despesasTotalInline.innerHTML = `<span>Total do período</span><strong>${brl(totalDespesas)}</strong>`;
  if (tabelaDespesas.children.length === 0) {
    const linhaVazia = document.createElement("tr");
    linhaVazia.className = "empty-expenses-row";
    linhaVazia.innerHTML = `<td colspan="6"><div class="empty-expenses"><i class="fa-regular fa-folder-open"></i><strong>Nenhuma despesa neste período</strong><span>Use “Nova despesa” para registrar um lançamento.</span></div></td>`;
    tabelaDespesas.appendChild(linhaVazia);
  }
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
  const btn = e.target.closest(".btnAcoes");
  if (btn) {
    agendamentoSelecionado = { 
      id: btn.dataset.id,
      nome: btn.dataset.nome,
      telefone: btn.dataset.tel,
      data: btn.dataset.data,
      periodo: btn.dataset.periodo,
      horario: btn.dataset.horario,
      procedimento: btn.dataset.procedimento,
      valor: btn.dataset.valor,
      valorBruto: Number(btn.dataset.valorbruto || 0),
      desconto: Number(btn.dataset.desconto || 0),
      reagendamentoPendente: btn.dataset.reagendamentopendente === "true"
    };
    document.getElementById("descontoRapido").hidden = true;
    document.getElementById("formReagendamentoRapido").hidden = true;
    document.querySelector("#modalAcoes .acoes-botoes").style.display = "flex";
    modalAcoes.style.display = "flex";
  }
});

// Fechar modal
fecharAcoes.onclick = () => modalAcoes.style.display = "none";
btnFecharModalAcoes.onclick = () => modalAcoes.style.display = "none";
window.onclick = (e) => { if (e.target === modalAcoes) modalAcoes.style.display = "none"; };

const formReagendamentoRapido = document.getElementById("formReagendamentoRapido");
const selectNovaDataAgendamento = document.getElementById("novaDataAgendamento");
const selectNovoHorarioAgendamento = document.getElementById("novoHorarioAgendamento");
const acoesModalLista = document.querySelector("#modalAcoes .acoes-botoes");
const mapaPeriodosReagendamento = [
  ["manha", "Manhã"], ["tarde", "Tarde"], ["noite", "Noite"]
];

function horariosLivresNaData(data, config, ocupadosPorData) {
  const bloqueados = new Set([...(config.horariosBloqueados?.[data] || []), ...(ocupadosPorData.get(data) || [])]);
  if (data === agendamentoSelecionado?.data && agendamentoSelecionado?.horario) bloqueados.add(agendamentoSelecionado.horario);
  const disponiveis = new Set();
  for (const [chave, periodo] of mapaPeriodosReagendamento) {
    const cfg = config.periodos?.[chave];
    if (!cfg || cfg.ativo === false) continue;
    for (let hora = Number(cfg.inicio); hora <= Number(cfg.fim); hora++) {
      const slot = `${String(hora).padStart(2, "0")}:00`;
      if (bloqueados.has(slot)) continue;
      const agora = new Date();
      const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
      if (data === hojeISO) {
        if (hora <= agora.getHours()) continue;
      }
      disponiveis.add(slot);
    }
  }
  return [...disponiveis].sort();
}

async function prepararOpcoesReagendamento() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const config = await carregarConfigDisponibilidade();
  let ocupadosPorData = new Map();
  try {
    const snapshot = await getDocs(query(collection(db, "horariosOcupados"), where("data", ">=", hojeISO)));
    snapshot.forEach((item) => {
      const { data, horario } = item.data();
      if (!data || !horario) return;
      if (!ocupadosPorData.has(data)) ocupadosPorData.set(data, []);
      ocupadosPorData.get(data).push(horario);
    });
  } catch (e) {
    console.error("Não foi possível consultar os horários livres:", e);
    throw new Error("Não foi possível consultar a agenda. Verifique a conexão e tente novamente.");
  }

  selectNovaDataAgendamento.innerHTML = '<option value="">Selecione uma data livre</option>';
  for (let deslocamento = 0; deslocamento < 365; deslocamento++) {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() + deslocamento);
    const dataISO = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
    if (config.diasSemana?.[data.getDay()] === false || (config.diasBloqueados || []).includes(dataISO)) continue;
    const horarios = horariosLivresNaData(dataISO, config, ocupadosPorData);
    if (!horarios.length) continue;
    const opcao = document.createElement("option");
    opcao.value = dataISO;
    opcao.textContent = `${data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} · ${horarios.length} horários`;
    selectNovaDataAgendamento.appendChild(opcao);
  }
  if (selectNovaDataAgendamento.options.length === 1) {
    selectNovaDataAgendamento.options[0].textContent = "Nenhuma data livre nos próximos 12 meses";
  }
  selectNovoHorarioAgendamento.innerHTML = '<option value="">Selecione uma data</option>';
  selectNovoHorarioAgendamento.disabled = true;
  document.getElementById("enviarReagendamento").disabled = true;
}

document.getElementById("acaoAbrirReagendamento").onclick = async () => {
  if (agendamentoSelecionado?.reagendamentoPendente) {
    return alert("Este atendimento já tem uma sugestão aguardando a cliente. Acompanhe pelo botão Pendentes no painel.");
  }
  document.getElementById("descontoRapido").hidden = true;
  acoesModalLista.style.display = "none";
  formReagendamentoRapido.hidden = false;
  selectNovaDataAgendamento.innerHTML = '<option value="">Carregando datas disponíveis...</option>';
  selectNovoHorarioAgendamento.innerHTML = '<option value="">Selecione uma data</option>';
  selectNovoHorarioAgendamento.disabled = true;
  try {
    await prepararOpcoesReagendamento();
  } catch (e) {
    alert(e.message || "Não foi possível carregar os horários disponíveis.");
    formReagendamentoRapido.hidden = true;
    acoesModalLista.style.display = "flex";
  }
};
document.getElementById("cancelarReagendamento").onclick = () => {
  formReagendamentoRapido.hidden = true;
  acoesModalLista.style.display = "flex";
};
selectNovaDataAgendamento.addEventListener("change", async () => {
  const data = selectNovaDataAgendamento.value;
  selectNovoHorarioAgendamento.innerHTML = '<option value="">Carregando horários...</option>';
  selectNovoHorarioAgendamento.disabled = true;
  document.getElementById("enviarReagendamento").disabled = true;
  if (!data) return;
  try {
    const config = await carregarConfigDisponibilidade();
    const dataLocal = new Date(`${data}T12:00:00`);
    const snapshot = await getDocs(query(collection(db, "horariosOcupados"), where("data", "==", data)));
    const ocupados = new Map([[data, snapshot.docs.map((item) => item.data().horario).filter(Boolean)]]);
    const diaBloqueado = config.diasSemana?.[dataLocal.getDay()] === false || (config.diasBloqueados || []).includes(data);
    const horarios = diaBloqueado ? [] : horariosLivresNaData(data, config, ocupados);
    selectNovoHorarioAgendamento.innerHTML = '<option value="">Selecione um horário livre</option>';
    horarios.forEach((hora) => {
      const opcao = document.createElement("option");
      opcao.value = hora;
      opcao.textContent = hora;
      selectNovoHorarioAgendamento.appendChild(opcao);
    });
    if (!horarios.length) selectNovoHorarioAgendamento.options[0].textContent = "Não há horários livres nesta data";
    selectNovoHorarioAgendamento.disabled = horarios.length === 0;
  } catch (e) {
    console.error("Não foi possível atualizar os horários disponíveis:", e);
    selectNovoHorarioAgendamento.innerHTML = '<option value="">Erro ao carregar horários</option>';
    alert("Não foi possível atualizar os horários. Tente selecionar a data novamente.");
  }
});
selectNovoHorarioAgendamento.addEventListener("change", () => {
  document.getElementById("enviarReagendamento").disabled = !selectNovoHorarioAgendamento.value;
});
function obterPeriodoReagendamento(config, horario) {
  const hora = Number(String(horario).split(":")[0]);
  for (const [chave, rotulo] of mapaPeriodosReagendamento) {
    const periodo = config.periodos?.[chave];
    if (periodo && periodo.ativo !== false && hora >= Number(periodo.inicio) && hora <= Number(periodo.fim)) return rotulo;
  }
  return agendamentoSelecionado?.periodo || "Manhã";
}

document.getElementById("enviarReagendamento").onclick = async () => {
  if (!agendamentoSelecionado) return;
  if (agendamentoSelecionado.reagendamentoPendente) return alert("Este atendimento já tem uma proposta pendente. Resolva a proposta atual antes de criar outra.");
  if (!(agendamentoSelecionado.telefone || "").replace(/\D/g, "")) return alert("A cliente não tem telefone cadastrado.");
  const dataISO = selectNovaDataAgendamento.value;
  const horario = selectNovoHorarioAgendamento.value;
  if (!dataISO || !horario) return alert("Escolha uma data e um horário disponível.");
  const janelaWhatsApp = window.open("about:blank", "_blank");
  if (!janelaWhatsApp) return alert("Permita a abertura de pop-ups para preparar a mensagem no WhatsApp.");
  const data = dataISO.split("-").reverse().join("/");
  const nome = agendamentoSelecionado.nome || "Maravilhosa";
  const mensagem = `Olá ${nome}, tudo bem? 💕\n\nPrecisamos reorganizar seu atendimento e encontrei uma opção disponível para você:\n\n📅 *${data}*\n🕒 *${horario}*\n\nEsse horário funciona para você? Me confirme por aqui para combinarmos direitinho. 😊`;
  let ocupacaoNova = null;
  const botaoEnvio = document.getElementById("enviarReagendamento");
  botaoEnvio.disabled = true;
  try {
    const config = await carregarConfigDisponibilidade();
    const dataLocal = new Date(`${dataISO}T12:00:00`);
    if (config.diasSemana?.[dataLocal.getDay()] === false || (config.diasBloqueados || []).includes(dataISO) || (config.horariosBloqueados?.[dataISO] || []).includes(horario)) {
      throw new Error("Essa data ou horário acabou de ser bloqueado. Escolha outra opção disponível.");
    }
    const ocupados = await getDocs(query(collection(db, "horariosOcupados"), where("data", "==", dataISO)));
    if (ocupados.docs.some((item) => item.data().horario === horario)) {
      throw new Error("Esse horário acabou de ser reservado. Escolha outra opção disponível.");
    }
    const periodo = obterPeriodoReagendamento(config, horario);
    ocupacaoNova = await addDoc(collection(db, "horariosOcupados"), {
      data: dataISO, horario, reagendamentoPendente: true, agendamentoId: agendamentoSelecionado.id
    });
    await updateDoc(doc(db, "agendamentos", agendamentoSelecionado.id), {
      reagendamentoPendente: {
        data: dataISO,
        horario,
        periodo,
        enviadoEm: new Date().toISOString(),
        ocupacaoId: ocupacaoNova.id
      }
    });
    const tel = (agendamentoSelecionado.telefone || "").replace(/\D/g, "");
    janelaWhatsApp.location.href = `https://wa.me/55${tel}?text=${encodeURIComponent(mensagem)}`;
    modalAcoes.style.display = "none";
    await verificarReagendamentosPendentes(true);
  } catch (e) {
    if (ocupacaoNova) await deleteDoc(doc(db, "horariosOcupados", ocupacaoNova.id)).catch(() => {});
    janelaWhatsApp.close();
    console.error("Não foi possível registrar a proposta de reagendamento:", e);
    alert(e.message || "Não foi possível registrar a proposta. Tente novamente.");
    botaoEnvio.disabled = false;
  }
};

const modalPendentes = document.getElementById("modalReagendamentosPendentes");
const listaPendentes = document.getElementById("listaReagendamentosPendentes");
const btnPendentes = document.getElementById("btnReagendamentosPendentes");
function atualizarBotaoPendentes(quantidade) {
  btnPendentes.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Pendentes${quantidade ? ` <span class="toolbar-count-pendentes">${quantidade}</span>` : ""}`;
  btnPendentes.setAttribute("aria-label", `${quantidade} propostas de reagendamento pendentes`);
}

async function resolverPropostaReagendamento(agendamento, aceitar) {
  const proposta = agendamento.reagendamentoPendente;
  if (!proposta) return;
  const agendamentoRef = doc(db, "agendamentos", agendamento.id);
  const batch = writeBatch(db);
  const ocupacaoRef = proposta.ocupacaoId
    ? doc(db, "horariosOcupados", proposta.ocupacaoId)
    : null;

  if (aceitar) {
    const ocupacoesDoNovoHorario = await getDocs(query(
      collection(db, "horariosOcupados"),
      where("data", "==", proposta.data),
      where("horario", "==", proposta.horario)
    ));
    const conflito = ocupacoesDoNovoHorario.docs.some((item) => item.id !== proposta.ocupacaoId);
    if (conflito) throw new Error("O horário sugerido foi ocupado por outro agendamento. Crie uma nova sugestão.");

    if (ocupacaoRef) {
      const hold = await getDoc(ocupacaoRef);
      if (hold.exists()) batch.update(ocupacaoRef, { reagendamentoPendente: false, agendamentoId: agendamento.id });
      else batch.set(ocupacaoRef, { data: proposta.data, horario: proposta.horario, reagendamentoPendente: false, agendamentoId: agendamento.id });
    } else {
      const novaOcupacaoRef = doc(collection(db, "horariosOcupados"));
      batch.set(novaOcupacaoRef, { data: proposta.data, horario: proposta.horario, reagendamentoPendente: false, agendamentoId: agendamento.id });
    }
    batch.update(agendamentoRef, {
      data: proposta.data,
      horario: proposta.horario,
      periodo: proposta.periodo || agendamento.periodo || "Manhã",
      reagendamentoPendente: deleteField(),
      reagendamentoConfirmadoEm: new Date().toISOString()
    });
    if (agendamento.data && agendamento.horario) {
      const ocupacoesAntigas = await getDocs(query(
        collection(db, "horariosOcupados"),
        where("data", "==", agendamento.data),
        where("horario", "==", agendamento.horario)
      ));
      ocupacoesAntigas.forEach((item) => {
        if (item.id !== proposta.ocupacaoId) batch.delete(doc(db, "horariosOcupados", item.id));
      });
    }
  } else {
    batch.update(agendamentoRef, { reagendamentoPendente: deleteField() });
    if (ocupacaoRef) batch.delete(ocupacaoRef);
  }

  await batch.commit();
  await carregarAgendamentos();
  await verificarReagendamentosPendentes(false);
  alert(aceitar
    ? `✅ Reagendamento de ${agendamento.nome || "cliente"} confirmado e atualizado na agenda.`
    : `A proposta foi cancelada. O horário original de ${agendamento.nome || "cliente"} continua na agenda.`);
}

async function verificarReagendamentosPendentes(abrirSeExistirem = false) {
  if (!auth.currentUser) return;
  try {
    const snapshot = await getDocs(collection(db, "agendamentos"));
    const pendentes = snapshot.docs
      .map((item) => ({ ...item.data(), id: item.id }))
      .filter((ag) => ag.reagendamentoPendente?.data && ag.reagendamentoPendente?.horario);
    atualizarBotaoPendentes(pendentes.length);
    listaPendentes.innerHTML = "";
    if (!pendentes.length) {
      listaPendentes.innerHTML = '<div class="pendentes-vazio">Nenhuma proposta aguardando resposta.</div>';
      if (abrirSeExistirem) modalPendentes.style.display = "none";
      return;
    }

    pendentes.sort((a, b) => String(a.reagendamentoPendente.enviadoEm || "").localeCompare(String(b.reagendamentoPendente.enviadoEm || "")));
    pendentes.forEach((ag) => {
      const proposta = ag.reagendamentoPendente;
      const card = document.createElement("article");
      card.className = "reagendamento-pendente-card";
      const titulo = document.createElement("h3");
      titulo.textContent = ag.nome || "Cliente";
      const contato = document.createElement("p");
      contato.textContent = `Telefone: ${ag.telefone || "não informado"}${ag.procedimento ? ` · ${ag.procedimento}` : ""}`;
      const original = document.createElement("p");
      original.textContent = `Horário atual: ${ag.data ? ag.data.split("-").reverse().join("/") : "-"} às ${ag.horario || "-"}`;
      const sugerido = document.createElement("p");
      sugerido.textContent = `Sugestão enviada: ${proposta.data.split("-").reverse().join("/")} às ${proposta.horario}${proposta.periodo ? ` · ${proposta.periodo}` : ""}`;
      const estado = document.createElement("p");
      const enviado = proposta.enviadoEm ? new Date(proposta.enviadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
      estado.textContent = `Aguardando confirmação${enviado ? ` desde ${enviado}` : ""}`;
      const acoes = document.createElement("div");
      acoes.className = "reagendamento-pendente-acoes";
      const confirmar = document.createElement("button");
      confirmar.className = "btnPrimario";
      confirmar.type = "button";
      confirmar.textContent = "✅ Confirmar novo horário";
      confirmar.onclick = async () => {
        if (!confirm(`A cliente confirmou ${proposta.data.split("-").reverse().join("/")} às ${proposta.horario}?`)) return;
        confirmar.disabled = true;
        try { await resolverPropostaReagendamento(ag, true); }
        catch (e) { console.error("Erro ao confirmar reagendamento:", e); alert(e.message || "Não foi possível confirmar. Tente novamente."); confirmar.disabled = false; }
      };
      const cancelar = document.createElement("button");
      cancelar.className = "btnSecundario";
      cancelar.type = "button";
      cancelar.textContent = "❌ Cancelar proposta";
      cancelar.onclick = async () => {
        if (!confirm("Cancelar a sugestão e liberar a vaga sugerida? O horário atual será mantido.")) return;
        cancelar.disabled = true;
        try { await resolverPropostaReagendamento(ag, false); }
        catch (e) { console.error("Erro ao cancelar proposta:", e); alert("Não foi possível cancelar a proposta. Tente novamente."); cancelar.disabled = false; }
      };
      acoes.append(confirmar, cancelar);
      card.append(titulo, contato, original, sugerido, estado, acoes);
      listaPendentes.appendChild(card);
    });
    if (abrirSeExistirem) modalPendentes.style.display = "flex";
  } catch (e) {
    console.error("Erro ao carregar propostas de reagendamento:", e);
    if (abrirSeExistirem) alert("Não foi possível carregar as propostas pendentes.");
  }
}

btnPendentes.addEventListener("click", () => verificarReagendamentosPendentes(true));
document.getElementById("fecharReagendamentosPendentes").addEventListener("click", () => { modalPendentes.style.display = "none"; });
window.addEventListener("click", (e) => { if (e.target === modalPendentes) modalPendentes.style.display = "none"; });

const modalListaEspera = document.getElementById("modalListaEspera");
const listaEsperaAdmin = document.getElementById("listaEsperaAdmin");
async function carregarListaEspera() {
  listaEsperaAdmin.innerHTML = '<p class="sinal-vazio">Carregando preferências...</p>';
  modalListaEspera.style.display = "flex";
  try {
    const snapshot = await getDocs(collection(db, "listaEspera"));
    const pedidos = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status === "aguardando")
      .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
    listaEsperaAdmin.innerHTML = "";
    if (!pedidos.length) {
      listaEsperaAdmin.innerHTML = '<p class="sinal-vazio">Nenhuma preferência aguardando atendimento.</p>';
      return;
    }
    pedidos.forEach((pedido) => {
      const card = document.createElement("article");
      card.className = "sinal-card lista-espera-card";
      const titulo = document.createElement("strong");
      titulo.className = "sinal-nome";
      titulo.textContent = pedido.nome || "Cliente";
      const info = document.createElement("div");
      info.className = "sinal-info";
      const data = pedido.dataPreferida ? pedido.dataPreferida.split("-").reverse().join("/") : "Sem data específica";
      const hora = pedido.horarioPreferido || "Sem horário específico";
      info.textContent = `Contato: ${pedido.telefone || "não informado"} · Preferência: ${data} · ${hora} · ${pedido.periodoPreferido || "qualquer período"}`;
      const procedimento = document.createElement("p");
      procedimento.textContent = `Serviços/combos: ${pedido.procedimento || "não informado"}`;
      const detalhes = document.createElement("p");
      detalhes.textContent = pedido.detalhes || "Sem observações adicionais.";
      const acoes = document.createElement("div");
      acoes.className = "lista-espera-acoes";
      const whatsapp = document.createElement("button");
      whatsapp.type = "button";
      whatsapp.className = "btnPrimario";
      whatsapp.textContent = "Conversar no WhatsApp";
      whatsapp.onclick = () => {
        const numeros = String(pedido.telefone || "").replace(/\D/g, "");
        if (!numeros) return alert("Esta cliente não informou um telefone.");
        const destino = numeros.startsWith("55") ? numeros : `55${numeros}`;
        const mensagem = `Oi, ${pedido.nome || "tudo bem"}! Vi sua preferência de horário para ${pedido.procedimento || "o atendimento"}. Vou verificar as opções e já retorno. 💕`;
        window.open(`https://wa.me/${destino}?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener");
      };
      const concluir = document.createElement("button");
      concluir.type = "button";
      concluir.className = "btnSecundario";
      concluir.textContent = "Marcar como resolvido";
      concluir.onclick = async () => {
        concluir.disabled = true;
        try {
          await updateDoc(doc(db, "listaEspera", pedido.id), { status: "resolvido", resolvidoEm: new Date().toISOString() });
          await carregarListaEspera();
        } catch (erro) {
          console.error("Não foi possível atualizar a lista de espera:", erro);
          alert("Não foi possível marcar este pedido como resolvido.");
          concluir.disabled = false;
        }
      };
      acoes.append(whatsapp, concluir);
      card.append(titulo, info, procedimento, detalhes, acoes);
      listaEsperaAdmin.appendChild(card);
    });
  } catch (erro) {
    console.error("Não foi possível carregar a lista de espera:", erro);
    listaEsperaAdmin.innerHTML = '<p class="sinal-vazio">Não foi possível carregar os pedidos. Verifique as regras do Firestore.</p>';
  }
}
document.getElementById("btnListaEspera").addEventListener("click", carregarListaEspera);
document.getElementById("fecharListaEspera").addEventListener("click", () => { modalListaEspera.style.display = "none"; });
window.addEventListener("click", (evento) => { if (evento.target === modalListaEspera) modalListaEspera.style.display = "none"; });

const modalSolicitacoesCliente = document.getElementById("modalSolicitacoesCliente");
const listaSolicitacoesCliente = document.getElementById("listaSolicitacoesCliente");
async function carregarSolicitacoesCliente() {
  modalSolicitacoesCliente.style.display = "flex";
  listaSolicitacoesCliente.innerHTML = '<p class="sinal-vazio">Carregando solicitações...</p>';
  try {
    const snapshot = await getDocs(collection(db, "solicitacoesCliente"));
    const pedidos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.status === "aguardando")
      .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
    listaSolicitacoesCliente.innerHTML = "";
    if (!pedidos.length) {
      listaSolicitacoesCliente.innerHTML = '<p class="sinal-vazio">Nenhuma solicitação pendente.</p>';
      return;
    }
    pedidos.forEach((pedido) => {
      const card = document.createElement("article");
      card.className = "sinal-card lista-espera-card";
      const nome = document.createElement("strong");
      nome.className = "sinal-nome";
      nome.textContent = pedido.nome || "Cliente";
      const info = document.createElement("div");
      info.className = "sinal-info";
      const tipo = pedido.tipo === "cancelamento" ? "Cancelamento" : pedido.tipo === "reagendamento" ? "Reagendamento" : "Outro assunto";
      info.textContent = `${tipo} · Telefone: ${pedido.telefone || "não informado"} · Atendimento atual: ${pedido.dataAtual || "não informado"}${pedido.dataDesejada ? ` · Nova preferência: ${pedido.dataDesejada} às ${pedido.horarioDesejado || "a combinar"}` : ""}`;
      const mensagem = document.createElement("p");
      mensagem.textContent = pedido.mensagem || "Sem mensagem adicional.";
      const acoes = document.createElement("div");
      acoes.className = "lista-espera-acoes";
      const whatsapp = document.createElement("button");
      whatsapp.className = "btnPrimario";
      whatsapp.type = "button";
      whatsapp.textContent = "Responder no WhatsApp";
      whatsapp.onclick = () => {
        const numeros = String(pedido.telefone || "").replace(/\D/g, "");
        if (numeros.length < 10) return alert("O telefone informado não é válido.");
        const destino = numeros.startsWith("55") ? numeros : `55${numeros}`;
        const texto = `Olá, ${pedido.nome || "tudo bem"}! Vi sua solicitação de ${tipo.toLowerCase()} enviada pelo site. Vou te ajudar com isso. 💕`;
        window.open(`https://wa.me/${destino}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
      };
      const resolver = document.createElement("button");
      resolver.className = "btnSecundario";
      resolver.type = "button";
      resolver.textContent = "Marcar como resolvida";
      resolver.onclick = async () => {
        if (!confirm("Confirma que esta solicitação já foi tratada?")) return;
        resolver.disabled = true;
        try {
          await updateDoc(doc(db, "solicitacoesCliente", pedido.id), { status: "resolvido", resolvidoEm: new Date().toISOString() });
          await carregarSolicitacoesCliente();
        } catch (erro) {
          console.error("Não foi possível atualizar a solicitação:", erro);
          alert("Não foi possível marcar como resolvida.");
          resolver.disabled = false;
        }
      };
      acoes.append(whatsapp, resolver);
      card.append(nome, info, mensagem, acoes);
      listaSolicitacoesCliente.appendChild(card);
    });
  } catch (erro) {
    console.error("Não foi possível carregar as solicitações:", erro);
    listaSolicitacoesCliente.innerHTML = '<p class="sinal-vazio">Falha ao carregar. Confira as regras do Firestore.</p>';
  }
}
document.getElementById("btnSolicitacoesCliente").addEventListener("click", carregarSolicitacoesCliente);
document.getElementById("fecharSolicitacoesCliente").addEventListener("click", () => { modalSolicitacoesCliente.style.display = "none"; });
window.addEventListener("click", (evento) => { if (evento.target === modalSolicitacoesCliente) modalSolicitacoesCliente.style.display = "none"; });

const modalFeedbacksCliente = document.getElementById("modalFeedbacksCliente");
const listaFeedbacksCliente = document.getElementById("listaFeedbacksCliente");
async function carregarFeedbacksCliente() {
  modalFeedbacksCliente.style.display = "flex";
  listaFeedbacksCliente.innerHTML = '<p class="sinal-vazio">Carregando feedbacks...</p>';
  try {
    const snapshot = await getDocs(collection(db, "feedbacks"));
    const feedbacks = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
      .sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
    listaFeedbacksCliente.innerHTML = "";
    if (!feedbacks.length) {
      listaFeedbacksCliente.innerHTML = '<p class="sinal-vazio">Nenhum feedback recebido ainda.</p>';
      return;
    }
    feedbacks.forEach((feedback) => {
      const card = document.createElement("article");
      card.className = "sinal-card lista-espera-card";
      const titulo = document.createElement("strong");
      titulo.className = "sinal-nome";
      titulo.textContent = `${feedback.nome || "Cliente"} · ${"★".repeat(Number(feedback.avaliacao) || 0)}${"☆".repeat(5 - (Number(feedback.avaliacao) || 0))}`;
      const texto = document.createElement("p");
      texto.textContent = feedback.mensagem || "Sem comentário.";
      const info = document.createElement("div");
      info.className = "sinal-info";
      info.textContent = `${feedback.dataAtendimento || "Data não informada"} · ${feedback.publicado ? "Visível no site" : "Privado"}`;
      const acoes = document.createElement("div");
      acoes.className = "lista-espera-acoes";
      const publicar = document.createElement("button");
      publicar.className = feedback.publicado ? "btnSecundario" : "btnPrimario";
      publicar.type = "button";
      publicar.textContent = feedback.publicado ? "Retirar do site" : "Aprovar e publicar";
      publicar.onclick = async () => {
        publicar.disabled = true;
        try {
          await updateDoc(doc(db, "feedbacks", feedback.id), {
            publicado: !feedback.publicado,
            status: feedback.publicado ? "aguardando" : "publicado"
          });
          await carregarFeedbacksCliente();
        } catch (erro) {
          console.error("Não foi possível atualizar a publicação do feedback:", erro);
          alert("Não foi possível atualizar este feedback.");
          publicar.disabled = false;
        }
      };
      acoes.appendChild(publicar);
      card.append(titulo, texto, info, acoes);
      listaFeedbacksCliente.appendChild(card);
    });
  } catch (erro) {
    console.error("Não foi possível carregar os feedbacks:", erro);
    listaFeedbacksCliente.innerHTML = '<p class="sinal-vazio">Falha ao carregar. Confira as regras do Firestore.</p>';
  }
}
document.getElementById("btnFeedbacksCliente").addEventListener("click", carregarFeedbacksCliente);
document.getElementById("fecharFeedbacksCliente").addEventListener("click", () => { modalFeedbacksCliente.style.display = "none"; });
window.addEventListener("click", (evento) => { if (evento.target === modalFeedbacksCliente) modalFeedbacksCliente.style.display = "none"; });

const descontoRapido = document.getElementById("descontoRapido");
const valorDescontoRapido = document.getElementById("valorDescontoRapido");
document.getElementById("acaoDesconto").onclick = () => {
  acoesModalLista.style.display = "none";
  descontoRapido.hidden = false;
  valorDescontoRapido.value = agendamentoSelecionado?.desconto || "";
  valorDescontoRapido.max = agendamentoSelecionado?.valorBruto || "";
  valorDescontoRapido.focus();
};
document.getElementById("cancelarDescontoRapido").onclick = () => {
  descontoRapido.hidden = true;
  acoesModalLista.style.display = "flex";
};
document.getElementById("salvarDescontoRapido").onclick = async () => {
  if (!agendamentoSelecionado) return;
  const desconto = Number(valorDescontoRapido.value || 0);
  if (!Number.isFinite(desconto) || desconto < 0 || desconto > agendamentoSelecionado.valorBruto) {
    return alert(`Informe um desconto entre R$ 0,00 e ${brl(agendamentoSelecionado.valorBruto)}.`);
  }
  const btnSalvarDesconto = document.getElementById("salvarDescontoRapido");
  btnSalvarDesconto.disabled = true;
  try {
    await updateDoc(doc(db, "agendamentos", agendamentoSelecionado.id), { desconto });
    descontoRapido.hidden = true;
    modalAcoes.style.display = "none";
    await carregarAgendamentos();
  } catch (error) {
    console.error("Não foi possível aplicar o desconto:", error);
    alert("Não foi possível salvar o desconto. Tente novamente.");
  } finally {
    btnSalvarDesconto.disabled = false;
  }
};

// --- Editar --- //
document.getElementById("acaoEditar").onclick = async () => {
  if (agendamentoSelecionado?.reagendamentoPendente) return alert("Resolva a proposta pendente antes de editar este agendamento.");
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
  document.getElementById("tempoMedioManual").textContent = (Number(ag.tempoMedioMinutos) || tempoMedioDoProcedimento(ag.procedimento)) > 0
    ? `Tempo médio: ${formatarTempoMedio(Number(ag.tempoMedioMinutos) || tempoMedioDoProcedimento(ag.procedimento))}`
    : "Tempo médio não cadastrado no catálogo";
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

    const atualizacao = {
      nome, telefone, telefoneBusca: telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""),
      data, periodo, horario, procedimento, formaPagamento, valor, desconto, observacoes: obs,
      tempoMedioMinutos: tempoMedioDoProcedimento(procedimento)
    };

    // Atualiza a coleção pública de horários ocupados caso a data/horário tenham mudado
    if (ag.data !== data || ag.horario !== horario) {
      await removerHorarioOcupado(ag.data, ag.horario);
      const slotId = await adicionarHorarioOcupado(data, horario, agendamentoSelecionado.id);
      if (slotId) atualizacao.slotId = slotId;
    }
    await updateDoc(doc(db, "agendamentos", agendamentoSelecionado.id), atualizacao);

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

// --- Agradecimento (a qualquer momento) --- //
document.getElementById("acaoAgradecer").onclick = () => {
  modalAcoes.style.display = "none";
  if (!(agendamentoSelecionado.telefone || "").replace(/\D/g, "")) return alert("Telefone não informado!");
  abrirWhatsApp(agendamentoSelecionado.telefone, msgAgradecimento(agendamentoSelecionado.nome));
};

// --- Excluir --- //
document.getElementById("acaoExcluir").onclick = async () => {
  if (agendamentoSelecionado?.reagendamentoPendente) return alert("Resolva ou cancele a proposta pendente antes de excluir este agendamento.");
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
btnNovoAtendimento.addEventListener("click", async () => {
  try { await carregarCatalogoPrecosAdmin(); }
  catch (e) { console.error("Não foi possível sincronizar o catálogo de preços:", e); }
  document.getElementById("tempoMedioManual").textContent = "Selecione um procedimento para ver o tempo médio.";
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
  const tempoMedioMinutos = tempoMedioDoProcedimento(procedimento);

  if (!nome || !data || !horario || !procedimento) {
    alert("Preencha todos os campos obrigatórios!");
    return;
  }

  const agendamentoRef = await addDoc(collection(db, "agendamentos"), {
    nome, telefone, telefoneBusca: telefone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, ""), data, periodo, horario, procedimento,
    formaPagamento, valor, desconto, observacoes: obs, tempoMedioMinutos, concluido: false
  });
  const slotId = await adicionarHorarioOcupado(data, horario, agendamentoRef.id);
  if (slotId) await updateDoc(doc(db, "agendamentos", agendamentoRef.id), { slotId });

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
    if (!ag.canceladoCliente && ag.data?.startsWith(mes)) {
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
        `${brl(valorFinal)}`
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
        `${brl(valor)}`
      ]);
    }
  });

  if (!linhas.length && !linhasDespesas.length) {
    alert("Nenhum dado encontrado para este mês.");
    return false;
  }

  // Página 1 — Agendamentos
  pdf.setTextColor(38, 59, 52);
  pdf.setFont("helvetica", "bold");
pdf.setFontSize(16);
  pdf.text(`Agendamentos · ${mes}`, 14, 16);
pdf.setFont("helvetica", "normal");
pdf.setFontSize(10);
  if (linhas.length) {
    pdf.autoTable({
      startY: 25,
      head: [["Nome", "Telefone", "Data", "Procedimento", "Pagamento", "Valor"]],
      body: linhas,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3, lineColor: [231, 226, 217], lineWidth: 0.1 },
      headStyles: { fillColor: [38, 59, 52], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 248, 244] },
      margin: { left: 14, right: 14 }
    });
  } else {
    pdf.setFontSize(10);
    pdf.text("Nenhum atendimento neste mês.", 14, 30);
  }
  const yAgendamentos = pdf.lastAutoTable?.finalY || 40;
  pdf.text(`Total bruto (atendimentos): ${brl(totalBruto)}`, 14, yAgendamentos + 10);

  // Página 2 — Despesas (nova planilha/página do relatório)
  pdf.addPage();
  pdf.setTextColor(38, 59, 52);
  pdf.setFont("helvetica", "bold");
pdf.setFontSize(16);
  pdf.text(`Despesas · ${mes}`, 14, 16);
pdf.setFont("helvetica", "normal");
pdf.setFontSize(10);
  if (linhasDespesas.length) {
    pdf.autoTable({
      startY: 25,
      head: [["Despesa", "Data", "Descrição", "Pagamento", "Valor"]],
      body: linhasDespesas,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3, lineColor: [231, 226, 217], lineWidth: 0.1 },
      headStyles: { fillColor: [38, 59, 52], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 248, 244] },
      margin: { left: 14, right: 14 }
    });
  } else {
    pdf.setFontSize(10);
    pdf.text("Nenhuma despesa registrada neste mês.", 14, 30);
  }
  const yDespesas = pdf.lastAutoTable?.finalY || 40;
  pdf.text(`Total de despesas: ${brl(totalDespesas)}`, 14, yDespesas + 10);

  // --- Resumo Financeiro final (já descontando as despesas) --- //
  const totalLiquido = totalBruto - totalDespesas;
  pdf.setFontSize(12);
  pdf.text("Resumo Financeiro", 14, yDespesas + 25);
  pdf.setFontSize(10);
  pdf.text(`Total bruto: ${brl(totalBruto)}`, 14, yDespesas + 33);
  pdf.text(`Total de despesas: ${brl(totalDespesas)}`, 14, yDespesas + 40);
  pdf.setFontSize(11);
  pdf.text(`Total líquido: ${brl(totalLiquido)}`, 14, yDespesas + 49);

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
  if (mes === "todos") return alert("Selecione um mês específico (o filtro está em 'Mês atual em diante').");
  pdfExportado = await exportarPDF(mes);
};

btnApagarMes.onclick = async () => {
  if (!pdfExportado) {
    alert("⚠️ Exporte o PDF antes de apagar.");
    return;
  }

  const mes = filtroMesAtual;
  if (mes === "todos") return alert("Selecione um mês específico (o filtro está em 'Mês atual em diante').");
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










