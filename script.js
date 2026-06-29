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
let cacheLogins = [];
let cacheProntos = [];
let cacheFalhas = [];
let cacheUsuarios = [];

function getUsuarios() { return cacheUsuarios; }

async function recarregarLogins() {
    const { data, error } = await sb.from("login").select("*").order("criado_em", { ascending: true });
    if (!error && data) cacheLogins = data;
    return !error;
}
async function recarregarProntos() {
    const { data, error } = await sb.from("prontos").select("*").order("criado_em", { ascending: false });
    if (!error && data) cacheProntos = data;
    return !error;
}
async function recarregarFalhas() {
    const { data, error } = await sb.from("falha").select("*").order("criado_em", { ascending: false });
    if (!error && data) cacheFalhas = data;
    return !error;
}
async function recarregarUsuarios() {
    const { data, error } = await sb.from("usuarios").select("*");
    if (!error && data) cacheUsuarios = data;
    return !error;
}
async function carregarTudo() {
    await Promise.all([recarregarLogins(), recarregarProntos(), recarregarFalhas(), recarregarUsuarios()]);
}

// ============================================================
// Fila — mostra o login atual (acesso, senha, 2fa)
// ============================================================
let loginAtual = null;

function carregarFila() {
    if (cacheLogins.length > 0) {
        loginAtual = cacheLogins[0];
        setText("fAcesso", loginAtual.acesso || "—");
        setText("fSenha", loginAtual.senha || "—");
        setText("f2fa", loginAtual.dois_fa || "—");
    } else {
        loginAtual = null;
        setText("fAcesso", "—");
        setText("fSenha", "—");
        setText("f2fa", "—");
    }
    // Campos sem origem de dados por enquanto (login só tem acesso/senha/2fa)
    setText("fNumero", "—");
    setText("fData", "—");
    setText("fSenhaBranca", "—");
    setText("fNome", "—");
    setText("fRua", "—");
    atualizarBotoesFila();
}

function atualizarBotoesFila() {
    const semFila = !loginAtual;
    const pr = $("pronta");
    const fb = $("filaFalha");
    if (pr) pr.disabled = semFila;
    if (fb) fb.disabled = semFila;
}

// Move o login atual para outra tabela (prontos ou falha) e o tira da fila
async function moverLogin(item, destino) {
    const { error: e1 } = await sb.from(destino).insert({
        acesso: item.acesso, senha: item.senha, dois_fa: item.dois_fa
    });
    if (e1) { mostrarToast("Erro ao mover o login"); return false; }
    const { error: e2 } = await sb.from("login").delete().eq("id", item.id);
    if (e2) { mostrarToast("Erro ao tirar da fila"); return false; }
    return true;
}

async function marcarPronta() {
    if (!loginAtual) return;
    const ok = await moverLogin(loginAtual, "prontos");
    if (!ok) return;
    await Promise.all([recarregarLogins(), recarregarProntos()]);
    carregarFila();
    renderLoginTudo();
    mostrarToast("Login marcado como pronto");
}

function abrirModalFalha() {
    if (!loginAtual) return;
    $("falhaModal").classList.remove("hidden");
}
function fecharModalFalha() {
    $("falhaModal").classList.add("hidden");
}
async function confirmarFalhaLogin() {
    fecharModalFalha();
    if (!loginAtual) return;
    const ok = await moverLogin(loginAtual, "falha");
    if (!ok) return;
    await Promise.all([recarregarLogins(), recarregarFalhas()]);
    carregarFila();
    renderLoginTudo();
    mostrarToast("Login marcado como falha");
}

// ============================================================
// Aba Login — adicionar logins e ver Disponíveis / Prontos / Falha
// ============================================================
async function adicionarLogin(acesso, senha, dois_fa) {
    const { error } = await sb.from("login").insert({ acesso: acesso, senha: senha, dois_fa: dois_fa });
    if (error) { mostrarToast("Erro ao adicionar login"); return false; }
    await recarregarLogins();
    return true;
}

// Devolve um login de prontos/falha de volta para a fila
async function devolverParaFila(origem, item) {
    const { error: e1 } = await sb.from("login").insert({
        acesso: item.acesso, senha: item.senha, dois_fa: item.dois_fa
    });
    if (e1) { mostrarToast("Erro ao devolver"); return; }
    const { error: e2 } = await sb.from(origem).delete().eq("id", item.id);
    if (e2) { mostrarToast("Erro ao remover"); return; }
    await Promise.all([recarregarLogins(), origem === "prontos" ? recarregarProntos() : recarregarFalhas()]);
    carregarFila();
    renderLoginTudo();
    mostrarToast("Login devolvido para a fila");
}

async function removerLogin(origem, id) {
    const { error } = await sb.from(origem).delete().eq("id", id);
    if (error) { mostrarToast("Erro ao remover"); return; }
    if (origem === "login") await recarregarLogins();
    else if (origem === "prontos") await recarregarProntos();
    else await recarregarFalhas();
    carregarFila();
    renderLoginTudo();
}

function renderListaLogin(arr, ulId, origem) {
    const ul = $(ulId);
    if (!ul) return;
    ul.innerHTML = "";
    if (!arr || arr.length === 0) {
        const v = document.createElement("li");
        v.className = "conta-empty";
        v.textContent = "Nada aqui ainda.";
        ul.appendChild(v);
        return;
    }
    arr.forEach(item => {
        const li = document.createElement("li");
        li.className = "conta-item";
        const info = document.createElement("div");
        info.className = "conta-info";
        const ac = document.createElement("span");
        ac.className = "conta-email";
        ac.textContent = item.acesso || "—";
        const sub = document.createElement("span");
        sub.className = "conta-senha";
        sub.textContent = [item.senha, item.dois_fa].filter(Boolean).join(" · ") || "—";
        info.appendChild(ac);
        info.appendChild(sub);
        li.appendChild(info);
        if (origem !== "login") {
            li.appendChild(botao("reopen-btn", "devolver", () => devolverParaFila(origem, item)));
        }
        li.appendChild(botao("del-btn", "remover", () => removerLogin(origem, item.id)));
        ul.appendChild(li);
    });
}

function renderLoginTudo() {
    renderListaLogin(cacheLogins, "listaLogins", "login");
    renderListaLogin(cacheProntos, "listaProntos", "prontos");
    renderListaLogin(cacheFalhas, "listaFalha", "falha");
    setText("stDisponiveis", String(cacheLogins.length));
    setText("stProntos", String(cacheProntos.length));
    setText("stFalha", String(cacheFalhas.length));
}

function mostrarSubLogin(sub) {
    document.querySelectorAll("[data-lsub]").forEach(b => {
        b.classList.toggle("active", b.getAttribute("data-lsub") === sub);
    });
    $("lsubDisponiveis").classList.toggle("hidden", sub !== "disponiveis");
    $("lsubProntos").classList.toggle("hidden", sub !== "prontos");
    $("lsubFalha").classList.toggle("hidden", sub !== "falha");
    renderLoginTudo();
}

// ============================================================
// Usuários e login (autenticação)
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
    $("tabLogin").classList.toggle("hidden", !adm);
    $("tabUsuarios").classList.toggle("hidden", !adm);
}

function atualizarUsuarioUI() {
    const nome = sessionStorage.getItem("cc_user") || "—";
    setText("userName", nome);
    setText("userRole", ehAdmin() ? "Administrador" : "Atendente");
    setText("userAvatar", (nome[0] || "?").toUpperCase());
}

function mostrarAba(view) {
    if ((view === "login" || view === "usuarios") && !ehAdmin()) view = "fila";
    document.querySelectorAll(".nav-item").forEach(t => {
        t.classList.toggle("active", t.getAttribute("data-view") === view);
    });
    $("viewFila").classList.toggle("hidden", view !== "fila");
    $("viewLogin").classList.toggle("hidden", view !== "login");
    $("viewUsuarios").classList.toggle("hidden", view !== "usuarios");
    if (view === "fila") carregarFila();
    if (view === "login") mostrarSubLogin("disponiveis");
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

document.querySelectorAll("[data-lsub]").forEach(b => {
    b.addEventListener("click", () => mostrarSubLogin(b.getAttribute("data-lsub")));
});

$("pronta").addEventListener("click", marcarPronta);
$("filaFalha").addEventListener("click", abrirModalFalha);
$("confirmarFalha").addEventListener("click", confirmarFalhaLogin);
$("recusarFalha").addEventListener("click", fecharModalFalha);
$("falhaModal").addEventListener("click", (e) => { if (e.target === $("falhaModal")) fecharModalFalha(); });

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

$("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    const acesso = $("lgAcesso").value.trim();
    if (!acesso) return;
    const ok = await adicionarLogin(acesso, $("lgSenha").value.trim(), $("lg2fa").value.trim());
    if (!ok) return;
    e.target.reset();
    $("lgAcesso").focus();
    carregarFila();
    renderLoginTudo();
    mostrarToast("Login adicionado");
});

$("limparLogins").addEventListener("click", async () => {
    if (cacheLogins.length === 0) return;
    if (!confirm("Remover todos os logins disponíveis?")) return;
    const ids = cacheLogins.map(l => l.id);
    const { error } = await sb.from("login").delete().in("id", ids);
    if (error) { mostrarToast("Erro ao limpar"); return; }
    await recarregarLogins();
    carregarFila();
    renderLoginTudo();
    mostrarToast("Logins removidos");
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
