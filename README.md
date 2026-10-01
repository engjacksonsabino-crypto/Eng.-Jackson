# Eng.-Jackson — Dashboard de Controle de Tutoria

Painel web para visualizar e analisar dados de tutoria a partir de uma planilha Excel.

## Como usar

### 1. Abrir o dashboard

**Local:**
```bash
cd Eng.-Jackson
python -m http.server 8000
```

Depois acesse: `http://localhost:8000`

### 2. Enviar a planilha

- Clique em **"Enviar planilha"** na barra lateral esquerda
- Selecione o arquivo `.xlsx` ou `.csv`
- O dashboard carregará automaticamente com os dados

## O que o dashboard mostra

✅ **Cards de indicadores:**
- Total de registros
- Percentual de concluídos
- Quantidade de categorias únicas
- Média de valores numéricos

📊 **Gráficos:**
- Status (pizza)
- Distribuição por categoria (barras)
- Linha do tempo (linha)

📋 **Tabela:** Primeiras 50 linhas dos dados

## Compatibilidade

- ✅ Excel (`.xlsx`, `.xls`)
- ✅ CSV (`.csv`)
- Navegadores modernos: Chrome, Firefox, Safari, Edge

## Observações

O dashboard tenta detectar automaticamente:
- **Status:** colunas com nomes como "status", "situação", "estado"
- **Datas:** colunas com nomes como "data", "período", "mês"
- **Categorias:** colunas com nomes como "tutor", "aluno", "disciplina", "turma"
- **Números:** colunas com valores numéricos para calcular média

Se os nomes das suas colunas forem diferentes, o script tenta se adaptar.

## Próximos passos

- [ ] Filtros avançados (por aluno, disciplina, período)
- [ ] Exportação em PDF
- [ ] Gráficos customizáveis
- [ ] Integração com banco de dados

---

**Desenvolvido para o Controle de Tutoria de Práticas**
