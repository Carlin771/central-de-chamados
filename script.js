// ============================================================
// Central de Chamados — dados no Supabase (Postgres) via supabase-js
// Login é demonstrativo. A chave abaixo é a "anon" (pública por design).
// ============================================================

const SB_URL = "https://efdaibgkkboblmkrirnk.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmZGFpYmdra2JvYmxta3Jpcm5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTQxMjksImV4cCI6MjA5ODMzMDEyOX0.pJueqjeAcyymiLr6W4N2cRTnL8xUY0dJwIJrJ17Fgy0";
const sb = supabase.createClient(SB_URL, SB_KEY);

function $(id) { return document.getElementById(id); }
function setText(id, valor) { const el = $(id); if (el) el.textContent = valor; }

function botao(cls, texto, fn) {
    const b = document.createElement("button");
    b.className = cls;
    b.textContent = texto;
    b.addEventListener("click", fn);
    return b;
}

let toastTimer;
function mostrarToast(msg) {
    const toast = $("toast");
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

function copiarTexto(texto) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(texto);
    }
    return new Promise((resolve, reject) => {
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { document.execCommand("copy"); resolve(); }
        catch (e) { reject(e); }
        finally { document.body.removeChild(ta); }
    });
}

// ----- Caches em memória (carregados do Supabase) -----
let cacheChamados = [];
let cacheClientes = [];
let cacheUsuarios = [];

function getChamados() { return cacheChamados; }
function getClientes() { return cacheClientes; }
function getUsuarios() { return cacheUsuarios; }
function chamadosPorStatus(s) { return cacheChamados.filter(c => c.status === s); }

async function recarregarChamados() {
    const { data, error } = await sb.from("chamados").select("*").order("criado_em", { ascending: true });
    if (!error && data) cacheChamados = data;
    return !error;
}
async function recarregarClientes() {
    const { data, error } = await sb.from("clientes").select("*").order("nome", { ascending: true });
    if (!error && data) cacheClientes = data;
    return !error;
}
async function recarregarUsuarios() {
    const { data, error } = await sb.from("usuarios").select("*");
    if (!error && data) cacheUsuarios = data;
    return !error;
}
async function carregarTudo() {
    await Promise.all([recarregarChamados(), recarregarClientes(), recarregarUsuarios()]);
}

// ============================================================
// Chamados
// ============================================================
function prioClasse(p) {
    if (p === "Alta") return "prio-alta";
    if (p === "Baixa") return "prio-baixa";
    return "prio-media";
}
function prioBadge(p) {
    if (p === "Alta") return "alta";
    if (p === "Baixa") return "baixa";
    return "media";
}

let chamadoAtual = null;

function carregarFila() {
    const abertos = chamadosPorStatus("aberto");
    if (abertos.length > 0) {
        chamadoAtual = abertos[0];
        setText("fTitulo", chamadoAtual.titulo);
        setText("fDescricao", chamadoAtual.descricao || "—");
        setText("fCliente", chamadoAtual.cliente || "—");
        const prio = $("fPrioridade");
        prio.textContent = chamadoAtual.prioridade || "—";
        prio.className = "value " + prioClasse(chamadoAtual.prioridade);
    } else {
        chamadoAtual = null;
        setText("fTitulo", "—");
        setText("fDescricao", "—");
        setText("fCliente", "—");
        const prio = $("fPrioridade");
        prio.textContent = "—";
        prio.className = "value";
    }
    atualizarBotoesFila();
}

function atualizarBotoesFila() {
    const semFila = !chamadoAtual;
    const cc = $("concluir"), nr = $("naoResolvido");
    if (cc) { cc.disabled = semFila; cc.textContent = semFila ? "Sem chamados na fila" : "Concluir chamado"; }
    if (nr) nr.disabled = semFila;
}

async function mudarStatusChamado(id, status) {
    const { error } = await sb.from("chamados").update({ status: status }).eq("id", id);
    if (error) { mostrarToast("Erro ao atualizar"); return; }
    await recarregarChamados();
    renderTudoChamados();
    carregarFila();
}

async function concluirChamado() {
    if (!chamadoAtual) return;
    await mudarStatusChamado(chamadoAtual.id, "concluido");
    mostrarToast("Chamado concluído");
}
async function naoResolvidoChamado() {
    if (!chamadoAtual) return;
    if (!confirm("Marcar este chamado como não resolvido (cancelado)?")) return;
    await mudarStatusChamado(chamadoAtual.id, "cancelado");
    mostrarToast("Chamado cancelado");
}

function atualizarStatsChamados() {
    setText("stAbertos", String(chamadosPorStatus("aberto").length));
    setText("stConcluidos", String(chamadosPorStatus("concluido").length));
    setText("stCancelados", String(chamadosPorStatus("cancelado").length));
}

function renderListaChamados(status, ulId) {
    const ul = $(ulId);
    if (!ul) return;
    const itens = chamadosPorStatus(status);
    ul.innerHTML = "";
    if (itens.length === 0) {
        const vazio = document.createElement("li");
        vazio.className = "conta-empty";
        vazio.textContent = "Nenhum chamado aqui.";
        ul.appendChild(vazio);
        return;
    }
    itens.forEach(ch => {
        const li = document.createElement("li");
        li.className = "conta-item";
        const info = document.createElement("div");
        info.className = "conta-info";
        const tit = document.createElement("span");
        tit.className = "conta-email";
        tit.textContent = ch.titulo;
        const sub = document.createElement("span");
        sub.className = "conta-senha";
        sub.textContent = [ch.cliente, ch.descricao].filter(Boolean).join(" · ") || "—";
        info.appendChild(tit);
        info.appendChild(sub);
        const badge = document.createElement("span");
        badge.className = "prio-badge " + prioBadge(ch.prioridade);
        badge.textContent = ch.prioridade || "Média";
        li.appendChild(info);
        li.appendChild(badge);
        if (status !== "aberto") {
            li.appendChild(botao("reopen-btn", "reabrir", () => mudarStatusChamado(ch.id, "aberto")));
        }
        li.appendChild(botao("del-btn", "remover", () => removerChamado(ch.id)));
        ul.appendChild(li);
    });
}

function renderTudoChamados() {
    renderListaChamados("aberto", "listaAbertos");
    renderListaChamados("concluido", "listaConcluidos");
    renderListaChamados("cancelado", "listaCancelados");
    atualizarStatsChamados();
}

async function removerChamado(id) {
    const { error } = await sb.from("chamados").delete().eq("id", id);
    if (error) { mostrarToast("Erro ao remover"); return; }
    await recarregarChamados();
    renderTudoChamados();
    carregarFila();
}

async function adicionarChamado(titulo, cliente, prioridade, descricao) {
    const { error } = await sb.from("chamados").insert({
        titulo: titulo, cliente: cliente, prioridade: prioridade, descricao: descricao, status: "aberto"
    });
    if (error) { mostrarToast("Erro ao abrir chamado"); return false; }
    await recarregarChamados();
    return true;
}

function normalizarPrio(p) {
    const x = (p || "").toLowerCase();
    if (x.indexOf("alta") === 0 || x.indexOf("alt") === 0) return "Alta";
    if (x.indexOf("baix") === 0) return "Baixa";
    return "Média";
}

function parseChamados(texto) {
    const out = [];
    let atual = null;
    const novo = () => ({ titulo: "", cliente: "", prioridade: "Média", descricao: "", status: "aberto" });
    const guardar = () => { if (atual && atual.titulo) out.push(atual); atual = null; };
    texto.split(/\r?\n/).forEach(raw => {
        const linha = raw.trim();
        if (!linha) return;
        let m;
        if ((m = linha.match(/^t[íi]tulo\s*:\s*(.*)$/i))) { guardar(); atual = novo(); atual.titulo = m[1].trim(); }
        else if ((m = linha.match(/^cliente\s*:\s*(.*)$/i))) { if (!atual) atual = novo(); atual.cliente = m[1].trim(); }
        else if ((m = linha.match(/^prioridade\s*:\s*(.*)$/i))) { if (!atual) atual = novo(); atual.prioridade = normalizarPrio(m[1].trim()); }
        else if ((m = linha.match(/^descri[çc][ãa]o\s*:\s*(.*)$/i))) { if (!atual) atual = novo(); atual.descricao = m[1].trim(); }
    });
    guardar();
    return out;
}

async function importarChamados(texto) {
    const novos = parseChamados(texto);
    if (novos.length === 0) return 0;
    const { error } = await sb.from("chamados").insert(novos);
    if (error) { mostrarToast("Erro ao importar"); return -1; }
    await recarregarChamados();
    return novos.length;
}

// ============================================================
// Clientes
// ============================================================
function renderClientes() {
    const ul = $("listaClientes");
    const cs = getClientes();
    ul.innerHTML = "";
    setText("stClientes", String(cs.length));
    if (cs.length === 0) {
        const v = document.createElement("li");
        v.className = "conta-empty";
        v.textContent = "Nenhum cliente cadastrado.";
        ul.appendChild(v);
        return;
    }
    cs.forEach(c => {
        const li = document.createElement("li");
        li.className = "conta-item";
        const info = document.createElement("div");
        info.className = "conta-info";
        const nome = document.createElement("span");
        nome.className = "conta-email";
        nome.textContent = c.nome;
        const sub = document.createElement("span");
        sub.className = "conta-senha";
        sub.textContent = [c.email, c.telefone, c.endereco].filter(Boolean).join(" · ") || "—";
        info.appendChild(nome);
        info.appendChild(sub);
        li.appendChild(info);
        li.appendChild(botao("del-btn", "remover", () => removerCliente(c.id)));
        ul.appendChild(li);
    });
}

async function salvarCliente(cliente) {
    const { error } = await sb.from("clientes").insert(cliente);
    if (error) { mostrarToast("Erro ao salvar cliente"); return false; }
    await recarregarClientes();
    return true;
}
async function removerCliente(id) {
    const { error } = await sb.from("clientes").delete().eq("id", id);
    if (error) { mostrarToast("Erro ao remover"); return; }
    await recarregarClientes();
    renderClientes();
}

async function buscarCepCliente() {
    const cep = ($("clCep").value || "").replace(/\D/g, "");
    if (cep.length !== 8) { mostrarToast("CEP deve ter 8 dígitos"); return; }
    const btn = $("buscarCep");
    btn.disabled = true;
    try {
        const resp = await fetch("https://viacep.com.br/ws/" + cep + "/json/");
        const d = await resp.json();
        if (d.erro) { mostrarToast("CEP não encontrado"); return; }
        const partes = [d.logradouro, d.bairro, d.localidade && (d.localidade + (d.uf ? "/" + d.uf : ""))].filter(Boolean);
        $("clEndereco").value = partes.join(", ");
        mostrarToast("Endereço preenchido");
    } catch (e) {
        mostrarToast("Falha ao buscar o CEP");
    } finally {
        btn.disabled = false;
    }
}

// ============================================================
// Usuários e login
// ============================================================
const USUARIOS_PADRAO = [
    { usuario: "admin", senha: "1234", admin: true }
];

function todosUsuarios() {
    return USUARIOS_PADRAO.concat(getUsuarios());
}

function renderUsuarios() {
    const ul = $("usuarioList");
    const criados = getUsuarios();
    ul.innerHTML = "";
    setText("statUsuarios", String(criados.length));
    const linha = (u, removivel) => {
        const li = document.createElement("li");
        li.className = "conta-item";
        const info = document.createElement("div");
        info.className = "conta-info";
        const nome = document.createElement("span");
        nome.className = "conta-email";
        nome.textContent = u.usuario;
        const papel = document.createElement("span");
        papel.className = "conta-senha";
        papel.textContent = u.admin ? "Administrador" : "Atendente";
        info.appendChild(nome);
        info.appendChild(papel);
        li.appendChild(info);
        if (removivel) {
            li.appendChild(botao("del-btn", "remover", () => removerUsuario(u.usuario)));
        } else {
            const tag = document.createElement("span");
            tag.className = "user-tag";
            tag.textContent = "padrão";
            li.appendChild(tag);
        }
        ul.appendChild(li);
    };
    USUARIOS_PADRAO.forEach(u => linha(u, false));
    criados.forEach(u => linha(u, true));
}

async function criarUsuario(usuario, senha, admin) {
    const { error } = await sb.from("usuarios").insert({ usuario: usuario, senha: senha, admin: admin });
    if (error) { mostrarToast("Erro ao criar usuário"); return false; }
    await recarregarUsuarios();
    return true;
}
async function removerUsuario(usuario) {
    const { error } = await sb.from("usuarios").delete().eq("usuario", usuario);
    if (error) { mostrarToast("Erro ao remover"); return; }
    await recarregarUsuarios();
    renderUsuarios();
}

const loginScreen = $("loginScreen");
const app = $("app");
const loginForm = $("loginForm");
const loginError = $("loginError");

function ehAdmin() { return sessionStorage.getItem("cc_admin") === "1"; }

function aplicarPermissoes() {
    const adm = ehAdmin();
    $("tabChamados").classList.toggle("hidden", !adm);
    $("tabClientes").classList.toggle("hidden", !adm);
    $("tabUsuarios").classList.toggle("hidden", !adm);
}

function atualizarUsuarioUI() {
    const nome = sessionStorage.getItem("cc_user") || "—";
    setText("userName", nome);
    setText("userRole", ehAdmin() ? "Administrador" : "Atendente");
    setText("userAvatar", (nome[0] || "?").toUpperCase());
}

function mostrarSubChamados(sub) {
    document.querySelectorAll(".subtab-btn").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-sub") === sub);
    });
    $("subAbertos").classList.toggle("hidden", sub !== "abertos");
    $("subConcluidos").classList.toggle("hidden", sub !== "concluidos");
    $("subCancelados").classList.toggle("hidden", sub !== "cancelados");
    renderTudoChamados();
}

function mostrarAba(view) {
    if ((view === "chamados" || view === "clientes" || view === "usuarios") && !ehAdmin()) view = "fila";
    document.querySelectorAll(".nav-item").forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-view") === view);
    });
    $("viewFila").classList.toggle("hidden", view !== "fila");
    $("viewChamados").classList.toggle("hidden", view !== "chamados");
    $("viewClientes").classList.toggle("hidden", view !== "clientes");
    $("viewUsuarios").classList.toggle("hidden", view !== "usuarios");
    if (view === "fila") carregarFila();
    if (view === "chamados") mostrarSubChamados("abertos");
    if (view === "clientes") renderClientes();
    if (view === "usuarios") renderUsuarios();
}

async function mostrarApp() {
    loginScreen.classList.add("hidden");
    app.classList.remove("hidden");
    aplicarPermissoes();
    atualizarUsuarioUI();
    await carregarTudo();
    mostrarAba("fila");
}

function entrar(conta) {
    sessionStorage.setItem("cc_logado", "1");
    sessionStorage.setItem("cc_admin", conta.admin ? "1" : "0");
    sessionStorage.setItem("cc_user", conta.usuario);
    mostrarApp();
}

function sair() {
    sessionStorage.removeItem("cc_logado");
    sessionStorage.removeItem("cc_admin");
    sessionStorage.removeItem("cc_user");
    app.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    loginForm.reset();
    $("user").focus();
}

async function tentarLogin(u, p) {
    const padrao = USUARIOS_PADRAO.find(x => x.usuario === u && x.senha === p);
    if (padrao) return padrao;
    await recarregarUsuarios();
    return cacheUsuarios.find(x => x.usuario === u && x.senha === p) || null;
}

// ============================================================
// Eventos
// ============================================================
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = $("user").value.trim();
    const p = $("pass").value;
    const conta = await tentarLogin(u, p);
    if (conta) { loginError.textContent = ""; entrar(conta); }
    else { loginError.textContent = "Usuário ou senha incorretos."; }
});

$("sair").addEventListener("click", sair);

document.querySelectorAll(".nav-item").forEach(t => {
    t.addEventListener("click", () => mostrarAba(t.getAttribute("data-view")));
});
document.querySelectorAll(".subtab-btn").forEach(b => {
    b.addEventListener("click", () => mostrarSubChamados(b.getAttribute("data-sub")));
});

$("concluir").addEventListener("click", concluirChamado);
$("naoResolvido").addEventListener("click", naoResolvidoChamado);

document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-copy");
        copiarTexto($(id).textContent).then(() => {
            const o = btn.textContent;
            btn.textContent = "Copiado!";
            btn.classList.add("copied");
            setTimeout(() => { btn.textContent = o; btn.classList.remove("copied"); }, 1200);
        });
    });
});

$("formChamado").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titulo = $("chTitulo").value.trim();
    if (!titulo) return;
    const ok = await adicionarChamado(titulo, $("chCliente").value.trim(), $("chPrioridade").value, $("chDescricao").value.trim());
    if (!ok) return;
    e.target.reset();
    $("chTitulo").focus();
    renderTudoChamados();
    carregarFila();
    mostrarToast("Chamado aberto");
});

$("bulkAddChamados").addEventListener("click", async () => {
    const n = await importarChamados($("bulkChamados").value);
    if (n <= 0) { if (n === 0) mostrarToast("Nenhum chamado reconhecido"); return; }
    $("bulkChamados").value = "";
    renderTudoChamados();
    carregarFila();
    mostrarToast(n === 1 ? "1 chamado importado" : n + " chamados importados");
});

$("limparAbertos").addEventListener("click", async () => {
    if (chamadosPorStatus("aberto").length === 0) return;
    if (!confirm("Remover todos os chamados abertos?")) return;
    const { error } = await sb.from("chamados").delete().eq("status", "aberto");
    if (error) { mostrarToast("Erro ao limpar"); return; }
    await recarregarChamados();
    renderTudoChamados();
    carregarFila();
    mostrarToast("Chamados abertos removidos");
});

$("buscarCep").addEventListener("click", buscarCepCliente);

$("formCliente").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nome = $("clNome").value.trim();
    if (!nome) return;
    const ok = await salvarCliente({
        nome: nome,
        email: $("clEmail").value.trim(),
        telefone: $("clTelefone").value.trim(),
        cep: $("clCep").value.trim(),
        endereco: $("clEndereco").value.trim()
    });
    if (!ok) return;
    e.target.reset();
    $("clNome").focus();
    renderClientes();
    mostrarToast("Cliente salvo");
});

$("limparClientes").addEventListener("click", async () => {
    if (getClientes().length === 0) return;
    if (!confirm("Remover todos os clientes?")) return;
    const ids = getClientes().map(c => c.id);
    const { error } = await sb.from("clientes").delete().in("id", ids);
    if (error) { mostrarToast("Erro ao limpar"); return; }
    await recarregarClientes();
    renderClientes();
    mostrarToast("Clientes removidos");
});

$("formUsuario").addEventListener("submit", async (e) => {
    e.preventDefault();
    const usuario = $("novoUsuario").value.trim();
    const senha = $("novaSenhaUser").value;
    const admin = $("novoUserAdmin").checked;
    if (!usuario || !senha) return;
    if (todosUsuarios().some(x => x.usuario.toLowerCase() === usuario.toLowerCase())) {
        mostrarToast("Esse usuário já existe");
        return;
    }
    const ok = await criarUsuario(usuario, senha, admin);
    if (!ok) return;
    e.target.reset();
    $("novoUsuario").focus();
    renderUsuarios();
    mostrarToast("Usuário criado");
});

if (sessionStorage.getItem("cc_logado") === "1") {
    mostrarApp();
}
