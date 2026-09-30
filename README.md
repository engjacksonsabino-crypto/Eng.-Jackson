# Eng.-Jackson - Sistema de Análise de Controle de Tutoria

Sistema para leitura, limpeza, análise e visualização dos dados de tutores a partir da planilha de controle de gerenciamento.

## Objetivo

Automatizar a análise da planilha principal e transformar os dados em indicadores, gráficos e relatórios gerenciais para acompanhamento operacional.

## Estrutura do projeto

```text
Eng.-Jackson/
├── dados/
│   └── GERENCIAMENTO CONTROLE JACKSON.xlsx
├── src/
│   ├── __init__.py
│   ├── tratamento.py
│   ├── analise.py
│   ├── dashboard.py
│   └── relatorio.py
├── requirements.txt
├── .gitignore
├── README.md
└── saidas/
    ├── graficos/
    └── relatorios/
```

## Regras de negócio consideradas

- A planilha principal é `GERENCIAMENTO CONTROLE JACKSON.xlsx`.
- A aba relevante é `02semestre`.
- Os dados começam aproximadamente na linha 4 (`header=3`).
- `X` indica tutor pendente.
- Célula preenchida representa gerenciamento.
- Vazio deve ser tratado como `SEM REGISTRO` quando necessário.
- Os status do tutor (Ativo, Novo, Desligado, etc.) devem ser analisados separadamente do status de gerenciamento.
- Dados originais não devem ser alterados.

## Instalação

```bash
python -m venv venv
source venv/bin/activate   # Linux/macOS
# ou
venv\Scripts\activate      # Windows
pip install -r requirements.txt
```

## Execução

### Análise e tratamento

```bash
python src/tratamento.py
python src/analise.py
```

### Dashboard Streamlit

```bash
streamlit run src/dashboard.py
```

## Observação importante

A estrutura real da planilha deve ser validada na primeira execução, pois as colunas e o formato exato podem variar conforme o preenchimento da planilha. O módulo de tratamento foi construído para identificar as colunas de ordem e aplicar a padronização necessária antes das análises.

## Próximas evoluções previstas

- Dashboard com cards e gráficos
- Relatório executivo em texto/Excel
- Comparação entre ordens
- Análise detalhada por tutor
- Exportação de indicadores
