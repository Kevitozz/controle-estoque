const API = "http://127.0.0.1:5000";

const nomeEl = document.getElementById("nome");
const categoriaEl = document.getElementById("categoria");
const fornecedorEl = document.getElementById("fornecedor");
const quantidadeEl = document.getElementById("quantidade");
const quantidadeMinEl = document.getElementById("quantidade_min");
const precoEl = document.getElementById("preco");

const produtoSelect = document.getElementById("produto");
const tipoSelect = document.getElementById("tipo_mov");
const qtdMovEl = document.getElementById("qtd_mov");

const tabelaEstoqueEl = document.getElementById("tabela-estoque");
const tabelaMovsEl = document.getElementById("tabela-movimentacoes");

let produtoParaExcluir = null;
let produtoParaEditar = null;

// navegação
function mostrarSecao(secao) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  const sec = document.getElementById(secao);
  if (sec) sec.classList.add("active");
  if (secao === "estoque") carregarEstoque();
  if (secao === "movimentacoes") carregarMovimentacoes();
  if (secao === "relatorios") carregarRelatorios();
}

// toast
function mostrarToast(msg) {
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = msg;
  document.getElementById("toast-container").appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// limpar form
function limparFormulario() {
  nomeEl.value = "";
  categoriaEl.value = "";
  fornecedorEl.value = "";
  quantidadeEl.value = "";
  quantidadeMinEl.value = "";
  precoEl.value = "";
}

// cadastrar
async function adicionarProduto() {
  const listaR = await fetch(`${API}/produtos`);
  const lista = await listaR.json();
  const nomeDigitado = (nomeEl.value || "").trim().toLowerCase();
  if (!nomeDigitado) { mostrarToast("Digite um nome válido."); return; }
  if (lista.some(p => (p.nome||"").toLowerCase() === nomeDigitado)) { mostrarToast("Já existe um produto com este nome."); return; }

  const novoProduto = {
    nome: nomeEl.value.trim(),
    categoria: categoriaEl.value.trim(),
    fornecedor: fornecedorEl.value.trim(),
    quantidade: Number.isInteger(parseInt(quantidadeEl.value,10)) ? parseInt(quantidadeEl.value,10) : 0,
    quantidade_min: Number.isInteger(parseInt(quantidadeMinEl.value,10)) ? parseInt(quantidadeMinEl.value,10) : 0,
    preco: isNaN(parseFloat(precoEl.value)) ? 0 : parseFloat(precoEl.value)
  };

  const r = await fetch(`${API}/produto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(novoProduto)
  });

  if (r.ok) {
    mostrarToast("Produto cadastrado!");
    limparFormulario();
    await carregarEstoque();
    await atualizarSelect();
  } else {
    const err = await r.json().catch(()=>({}));
    mostrarToast(err.erro || "Erro ao cadastrar produto.");
  }
}

// preencher select
async function atualizarSelect() {
  const r = await fetch(`${API}/produtos`);
  const produtos = await r.json();
  produtoSelect.innerHTML = "";
  produtos.forEach(p => {
    const op = document.createElement("option");
    op.value = p.nome;
    op.textContent = `${p.nome} (Estoque: ${p.quantidade})`;
    produtoSelect.appendChild(op);
  });
}

// estoque
async function carregarEstoque() {
  const r = await fetch(`${API}/produtos`);
  const dados = await r.json();
  tabelaEstoqueEl.innerHTML = "";

  dados.forEach(p => {
    const tr = document.createElement("tr");
    if (p.quantidade <= p.quantidade_min) tr.classList.add("low-stock");

    tr.innerHTML = `
      <td>${p.nome}</td>
      <td>${p.categoria}</td>
      <td>${p.fornecedor}</td>
      <td>${p.quantidade}</td>
      <td>${p.quantidade_min}</td>
      <td>R$ ${p.preco.toFixed(2)}</td>
      <td>
        <button class="btn-delete">🗑 Excluir</button>
        <button class="btn-edit" style="margin-left:8px">✏ Editar</button>
      </td>
    `;

    tr.querySelector(".btn-delete").addEventListener("click", () => {
      deletarProduto(p.nome);
    });

    tr.querySelector(".btn-edit").addEventListener("click", () => {
      abrirEdicao(p);
    });

    tabelaEstoqueEl.appendChild(tr);
  });

  // avisos estoque baixo
  dados.forEach(p => {
    if (p.quantidade <= p.quantidade_min) {
      mostrarToast(`⚠ Estoque baixo: ${p.nome} (Qtd: ${p.quantidade})`);
    }
  });
}

// abrir modal exclusão
function deletarProduto(nome) {
  produtoParaExcluir = nome;
  document.getElementById("modal-title").textContent = "Confirmar Exclusão";
  document.getElementById("modal-text").textContent = `Excluir "${nome}"?`;
  document.getElementById("modal-confirm").textContent = "Excluir";
  document.getElementById("modal-overlay").classList.remove("hidden");
}

// confirmação exclusão
document.getElementById("modal-cancel").addEventListener("click", () => {
  produtoParaExcluir = null;
  document.getElementById("modal-overlay").classList.add("hidden");
});

document.getElementById("modal-confirm").addEventListener("click", async () => {
  if (!produtoParaExcluir) return;
  const resposta = await fetch(`${API}/produto/${encodeURIComponent(produtoParaExcluir)}`, { method: "DELETE" });
  const r = await resposta.json().catch(()=>({}));
  if (resposta.ok) {
    mostrarToast("Produto excluído!");
    await carregarEstoque();
    await atualizarSelect();
  } else {
    mostrarToast(r.erro || "Erro ao excluir.");
  }
  produtoParaExcluir = null;
  document.getElementById("modal-overlay").classList.add("hidden");
});

// edição
function abrirEdicao(p) {
  produtoParaEditar = p.nome;
  document.getElementById("edit-nome").value = p.nome;
  document.getElementById("edit-categoria").value = p.categoria || "";
  document.getElementById("edit-fornecedor").value = p.fornecedor || "";
  document.getElementById("edit-quantidade_min").value = p.quantidade_min || 0;
  document.getElementById("edit-preco").value = p.preco || 0;
  document.getElementById("edit-overlay").classList.remove("hidden");
  // small change to modal confirm button text
  document.getElementById("edit-save").textContent = "Salvar";
}

document.getElementById("edit-cancel").addEventListener("click", () => {
  produtoParaEditar = null;
  document.getElementById("edit-overlay").classList.add("hidden");
});

document.getElementById("edit-save").addEventListener("click", async () => {
  if (!produtoParaEditar) return;
  const payload = {
    categoria: document.getElementById("edit-categoria").value.trim(),
    fornecedor: document.getElementById("edit-fornecedor").value.trim(),
    quantidade_min: Number.parseInt(document.getElementById("edit-quantidade_min").value || "0", 10),
    preco: Number.parseFloat(document.getElementById("edit-preco").value || "0")
  };

  const r = await fetch(`${API}/produto/${encodeURIComponent(produtoParaEditar)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (r.ok) {
    mostrarToast("Produto atualizado!");
    await carregarEstoque();
    await atualizarSelect();
    document.getElementById("edit-overlay").classList.add("hidden");
    produtoParaEditar = null;
  } else {
    const err = await r.json().catch(()=>({}));
    mostrarToast(err.erro || "Erro ao atualizar.");
  }
});

// movimentacoes - carrega histórico do servidor
async function carregarMovimentacoes() {
  const r = await fetch(`${API}/movimentacoes`);
  const dados = await r.json();
  tabelaMovsEl.innerHTML = "";
  dados.forEach(m => {
    tabelaMovsEl.innerHTML += `
      <tr>
        <td>${m.data}</td>
        <td>${m.nome}</td>
        <td>${m.tipo}</td>
        <td>${m.quantidade}</td>
      </tr>
    `;
  });
}

// registrar movimentação
async function registrarMovimentacao() {
  const produtoNome = produtoSelect.value;
  const tipo = tipoSelect.value;
  const qtd = parseInt(qtdMovEl.value,10);
  if (isNaN(qtd) || qtd <= 0) { mostrarToast("Quantidade inválida!"); return; }

  const rProd = await fetch(`${API}/produtos`);
  const produtos = await rProd.json();
  const prod = produtos.find(p => p.nome === produtoNome);
  if (!prod) { mostrarToast("Produto não encontrado."); return; }

  if (tipo === "saida" && (prod.quantidade - qtd) < prod.quantidade_min) {
    mostrarToast(`Não permitido: estoque ficaria abaixo do mínimo (${prod.quantidade_min}).`);
    return;
  }

  const r = await fetch(`${API}/movimentar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome: produtoNome, tipo, quantidade: qtd })
  });

  const respJson = await r.json().catch(()=>({}));
  if (!r.ok) { mostrarToast(respJson.erro || "Erro ao registrar movimentação."); return; }

  mostrarToast("Movimentação registrada!");
  qtdMovEl.value = "";
  await carregarMovimentacoes();
  await carregarEstoque();
  await atualizarSelect();
}

// relatórios simples
async function carregarRelatorios() {
  const rp = await fetch(`${API}/produtos`);
  const produtos = await rp.json();
  const rm = await fetch(`${API}/movimentacoes`);
  const movs = await rm.json();

  // valor total
  const valorTotal = produtos.reduce((s,p) => s + (p.preco || 0) * (p.quantidade || 0), 0);
  document.getElementById("relatorio-valor").textContent = `R$ ${valorTotal.toFixed(2)}`;

  // baixo estoque
  const baixoEl = document.getElementById("relatorio-baixo-estoque");
  baixoEl.innerHTML = "";
  produtos.filter(p => p.quantidade <= p.quantidade_min).forEach(p => {
    baixoEl.innerHTML += `<tr><td>${p.nome}</td><td>${p.quantidade}</td><td>${p.quantidade_min}</td></tr>`;
  });

  // movs
  const movsEl = document.getElementById("relatorio-movimentacoes");
  movsEl.innerHTML = "";
  movs.slice(0,50).forEach(m => {
    movsEl.innerHTML += `<tr><td>${m.data}</td><td>${m.nome}</td><td>${m.tipo}</td><td>${m.quantidade}</td></tr>`;
  });
}

document.getElementById("hamburger-btn").addEventListener("click", () => {
  const menu = document.getElementById("side-menu");
  menu.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  const menu = document.getElementById("side-menu");
  const btn = document.getElementById("hamburger-btn");
  if (!menu.contains(e.target) && e.target !== btn) menu.classList.add("hidden");
});

document.querySelectorAll(".theme-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.body.className = btn.dataset.theme === "escuro" ? "tema-escuro" : "theme-light";
    document.getElementById("side-menu").classList.add("hidden");
  });
});

// init
atualizarSelect();
carregarEstoque();
carregarMovimentacoes();
carregarRelatorios();
