from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import oracledb as cx
from datetime import datetime
from reportlab.pdfgen import canvas
from io import BytesIO

app = Flask(__name__)
CORS(app)

# ---------------- CONEXÃO ----------------
dsn = cx.makedsn("localhost", 1521, service_name="XE")
conn = cx.connect(user="system", password="asdrewfwbmz0", dsn=dsn)


# ---------------- TABELAS ----------------
def criar_tabelas():
    cur = conn.cursor()

    cur.execute("""
        BEGIN
            EXECUTE IMMEDIATE '
                CREATE TABLE produtos (
                    nome VARCHAR2(100) PRIMARY KEY,
                    categoria VARCHAR2(100),
                    fornecedor VARCHAR2(100),
                    quantidade NUMBER,
                    quantidade_min NUMBER,
                    preco NUMBER
                )';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    """)

    cur.execute("""
        BEGIN
            EXECUTE IMMEDIATE '
                CREATE TABLE movimentacoes (
                    id NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                    nome VARCHAR2(100),
                    tipo VARCHAR2(20),
                    quantidade NUMBER,
                    data_mov TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )';
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    """)

    conn.commit()


# ---------------- DADOS INICIAIS ----------------
def criar_exemplos():
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM produtos")
    total = cur.fetchone()[0]

    if total == 0:
        produtos = [
            ("Caneta Azul", "Papelaria", "Faber-Castell", 100, 20, 2.50),
            ("Caderno 200 folhas", "Papelaria", "Tilibra", 50, 10, 12.90),
            ("Mouse Wireless", "Informática", "Logitech", 30, 5, 89.90),
            ("Teclado Mecânico", "Informática", "Redragon", 15, 5, 199.90)
        ]

        cur.executemany("""
            INSERT INTO produtos (nome, categoria, fornecedor, quantidade, quantidade_min, preco)
            VALUES (:1,:2,:3,:4,:5,:6)
        """, produtos)

    cur.execute("SELECT COUNT(*) FROM movimentacoes")
    total_mov = cur.fetchone()[0]

    if total_mov == 0:
        movs = [
            ("Caneta Azul", "entrada", 50),
            ("Mouse Wireless", "entrada", 10),
            ("Caderno 200 folhas", "entrada", 20),
            ("Caneta Azul", "saida", 30),
            ("Teclado Mecânico", "saida", 8),
            ("Caderno 200 folhas", "saida", 45)
        ]

        cur.executemany("""
            INSERT INTO movimentacoes (nome, tipo, quantidade)
            VALUES (:1, :2, :3)
        """, movs)

    conn.commit()


criar_tabelas()
criar_exemplos()


# ---------------- LISTAR PRODUTOS ----------------
@app.get("/produtos")
def listar_produtos():
    cur = conn.cursor()
    cur.execute("SELECT nome, categoria, fornecedor, quantidade, quantidade_min, preco FROM produtos")

    lista = [
        {
            "nome": n,
            "categoria": c,
            "fornecedor": f,
            "quantidade": q,
            "quantidade_min": qm,
            "preco": float(p)
        }
        for n, c, f, q, qm, p in cur.fetchall()
    ]
    return jsonify(lista)


# ---------------- CADASTRAR PRODUTO ----------------
@app.post("/produto")
def adicionar_produto():
    d = request.json
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO produtos (nome, categoria, fornecedor, quantidade, quantidade_min, preco)
        VALUES (:1, :2, :3, :4, :5, :6)
    """, (d["nome"], d["categoria"], d["fornecedor"], d["quantidade"],
          d["quantidade_min"], d["preco"]))

    conn.commit()
    return jsonify({"status": "ok"})


# ---------------- EDITAR PRODUTO ----------------
@app.put("/produto/<nome>")
def editar_produto(nome):
    d = request.json
    cur = conn.cursor()

    cur.execute("""
        UPDATE produtos
        SET categoria = :cat,
            fornecedor = :forn,
            quantidade_min = :qmin,
            preco = :preco
        WHERE nome = :nome
    """, {
        "cat": d.get("categoria"),
        "forn": d.get("fornecedor"),
        "qmin": d.get("quantidade_min"),
        "preco": d.get("preco"),
        "nome": nome
    })

    conn.commit()
    return jsonify({"status": "ok"})


# ---------------- MOVIMENTAR ----------------
@app.post("/movimentar")
def movimentar():
    d = request.json
    nome = d["nome"]
    tipo = d["tipo"]
    qtd = int(d["quantidade"])

    cur = conn.cursor()
    cur.execute("SELECT quantidade, quantidade_min FROM produtos WHERE nome = :1", [nome])
    dados = cur.fetchone()

    if not dados:
        return jsonify({"erro": "Produto não encontrado."}), 400

    atual, minimo = dados

    if tipo == "entrada":
        novo = atual + qtd
    else:
        novo = atual - qtd
        if novo < minimo:
            return jsonify({"erro": f"Movimentação inválida: ficaria abaixo do mínimo ({minimo})."}), 400

    cur.execute("UPDATE produtos SET quantidade = :1 WHERE nome = :2", (novo, nome))

    cur.execute("""
        INSERT INTO movimentacoes (nome, tipo, quantidade)
        VALUES (:1,:2,:3)
    """, (nome, tipo, qtd))

    conn.commit()
    return jsonify({"status": "ok"})


# ---------------- LISTAR MOVIMENTAÇÕES ----------------
@app.get("/movimentacoes")
def listar_movimentacoes():
    cur = conn.cursor()

    cur.execute("""
        SELECT nome, tipo, quantidade, data_mov
        FROM movimentacoes
        ORDER BY data_mov DESC
    """)

    lista = []
    for n, t, q, d in cur.fetchall():
        data_str = d.strftime("%d/%m/%Y %H:%M:%S") if isinstance(d, datetime) else str(d)

        lista.append({
            "nome": n,
            "tipo": t,
            "quantidade": q,
            "data": data_str
        })

    return jsonify(lista)


# ---------------- DELETAR PRODUTO ----------------
@app.delete("/produto/<nome>")
def deletar_produto(nome):
    cur = conn.cursor()
    cur.execute("DELETE FROM produtos WHERE nome = :1", [nome])
    conn.commit()
    return jsonify({"status": "ok"})

# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(debug=True)
