# Eng.-Jackson

Este repositório contém uma planilha de controle de tutoria e agora inclui um dashboard web para visualizá-la.

## O que foi criado

- `index.html` — estrutura principal do painel
- `styles.css` — layout e visual do dashboard
- `script.js` — leitura da planilha Excel e geração dos gráficos
- `GERENCIAMENTO CONTROLE JACKSON.xlsx` — arquivo base da planilha do projeto

## Como usar

1. Faça o download ou clone este repositório.
2. Abra a pasta localmente em um servidor web simples.
3. Acesse a página em um navegador.

### Opção rápida com Python

```bash
cd Eng.-Jackson
python -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

## O que o dashboard faz

- carrega a planilha Excel diretamente do repositório
- identifica automaticamente colunas de status, datas e categorias
- calcula indicadores gerais
- monta gráficos e uma tabela resumida dos dados

## Observações

A lógica do dashboard tenta detectar automaticamente colunas comuns em uma planilha de tutoria como:

- status / situação
- data / agenda / período
- disciplina / turma / matéria / tutor / aluno
- valores numéricos para métricas

Se os nomes das colunas da sua planilha forem diferentes, o script ainda assim tenta ajustar a leitura e montar o painel de forma automática.

## Próximos passos recomendados

- personalizar títulos e cores para o perfil da sua gestão
- adicionar filtros por aluno, disciplina ou período
- integrar com uma API ou banco de dados
- exportar relatórios em PDF ou Excel
