# Eng.-Jackson

Este repositório foi reorganizado para suportar análise automatizada dos dados de controle de tutoria a partir da planilha Excel e geração de dashboard profissional.

## Estrutura do projeto

```text
Eng.-Jackson/
├── dados/
│   └── .gitkeep
├── saidas/
│   ├── graficos/
│   └── relatorios/
├── src/
│   ├── __init__.py
│   ├── analise.py
│   ├── dashboard.py
│   ├── relatorio.py
│   ├── streamlit_app.py
│   └── tratamento.py
├── GERENCIAMENTO CONTROLE JACKSON.xlsx
├── README.md
├── requirements.txt
└── .gitignore
```

## Como configurar o ambiente

1. Crie um ambiente virtual:

```bash
python -m venv .venv
```

2. Ative o ambiente:

Windows:
```bash
.venv\Scripts\activate
```

Linux/macOS:
```bash
source .venv/bin/activate
```

3. Instale as dependências:

```bash
pip install -r requirements.txt
```

## Como executar a análise

### Aplicação Streamlit

```bash
streamlit run src/streamlit_app.py
```

A interface permite:
- carregar a planilha Excel
- visualizar indicadores gerais
- analisar por ordem
- consultar tutores e pendências
- gerar relatório resumido

## Regra de negócio aplicada

O processamento está ajustado para respeitar as regras da planilha:

- `X` = pendente
- célula preenchida = gerenciou
- célula vazia = sem registro
- texto com variações de maiúsculas/minúsculas é normalizado
- nomes de tutores e status são padronizados antes da análise
- ordens e categorias são tratadas separadamente da situação de gerenciamento

## Atualização automática

Sempre que a planilha `GERENCIAMENTO CONTROLE JACKSON.xlsx` for substituída ou atualizada, basta executar novamente o projeto. O processo foi projetado para ser facilmente repetido sem alterar a lógica principal.

## Observações

- Os dados originais da planilha não são alterados.
- O sistema separa claramente:
  - status do tutor
  - status de gerenciamento
  - evolução por ordem
  - situação individual por tutor

## Próximos passos recomendados

- validar os nomes reais das colunas da planilha exportada
- ajustar os listados de categoria do tutor caso a base tenha nomenclaturas diferentes
- incluir filtros específicos por tutor ou ordem na interface
