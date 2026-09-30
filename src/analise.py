"""Módulo de tratamento e padronização da planilha de controle de tutoria."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Iterable

import numpy as np
import pandas as pd


class TratamentoDados:
    """Classe para carregar e limpar a planilha de controle de tutoria."""

    def __init__(self, caminho_planilha: str | Path, aba: str = "02semestre", header: int = 3):
        self.caminho_planilha = Path(caminho_planilha)
        self.aba = aba
        self.header = header
        self.df_original = None
        self.df_processado = None

    @staticmethod
    def limpar_texto(valor: Any) -> str:
        """Padroniza texto, remove espaços e deixa em maiúsculas."""
        if pd.isna(valor):
            return ""
        texto = str(valor).strip()
        texto = re.sub(r"\s+", " ", texto)
        return texto.upper()

    @staticmethod
    def limpar_status(valor: Any) -> str:
        """Classifica a célula conforme o padrão da planilha."""
        if pd.isna(valor) or str(valor).strip() == "":
            return "SEM REGISTRO"

        texto = str(valor).strip().upper()
        if texto in {"X", "X "}:
            return "PENDENTE"
        if texto in {"", "NAN", "NONE"}:
            return "SEM REGISTRO"
        return "GERENCIA"

    @staticmethod
    def normalizar_nome_tutor(nome: Any) -> str:
        """Normaliza nomes de titores para evitar pequenas variações de escrita."""
        if pd.isna(nome):
            return ""
        return TratamentoDados.limpar_texto(nome)

    @staticmethod
    def detectar_categoria_tutor(valor: Any) -> str:
        """Detecta a categoria do tutor com base em texto."""
        if pd.isna(valor) or str(valor).strip() == "":
            return "INDEFINIDO"

        texto = TratamentoDados.limpar_texto(valor)
        mapeamento = {
            "ATIVO": ["ATIVO", "ATIVA"],
            "NOVO TUTOR": ["NOVO", "NOVA"],
            "DESLIGADO": ["DESLIGADO", "DESLIGADA"],
            "EM TRILHA": ["EM TRILHA", "TRILHA"],
            "INATIVO": ["INATIVO", "INATIVA"],
            "AFASTADO": ["AFASTADO", "AFASTADA"],
            "AGRONOMIA": ["AGRONOMIA"],
        }

        for categoria, palavras in mapeamento.items():
            if any(p in texto for p in palavras):
                return categoria

        return "INDEFINIDO"

    def carregar_planilha(self) -> pd.DataFrame:
        """Carrega a planilha e retorna o DataFrame bruto."""
        if not self.caminho_planilha.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {self.caminho_planilha}")

        try:
            self.df_original = pd.read_excel(self.caminho_planilha, sheet_name=self.aba, header=self.header)
            print(f"Planilha carregada: {self.caminho_planilha.name}")
            print(f"Dimensões: {self.df_original.shape}")
            return self.df_original
        except ValueError:
            planilhas = pd.ExcelFile(self.caminho_planilha).sheet_names
            raise ValueError(
                f"Aba '{self.aba}' não encontrada. Abas disponíveis: {planilhas}"
            )

    def processar_dados(self) -> pd.DataFrame:
        """Aplica normalização, limpeza e padronização dos dados."""
        if self.df_original is None:
            self.carregar_planilha()

        df = self.df_original.copy()
        df = df.dropna(axis=0, how="all")
        df.columns = [self.limpar_texto(col) for col in df.columns]

        # Normaliza nomes de tutores e colunas
        if not df.empty:
            nome_coluna = df.columns[0]
            df[nome_coluna] = df[nome_coluna].apply(self.normalizar_nome_tutor)

        self.df_processado = df
        return df

    def relatorio_estrutura(self) -> dict:
        """Retorna resumo da estrutura da planilha."""
        if self.df_original is None:
            self.carregar_planilha()

        return {
            "linhas_totais": len(self.df_original),
            "colunas_totais": len(self.df_original.columns),
            "colunas": list(self.df_original.columns),
            "tipos": self.df_original.dtypes.to_dict(),
        }


if __name__ == "__main__":
    caminho = Path(__file__).resolve().parents[1] / "dados" / "GERENCIAMENTO CONTROLE JACKSON.xlsx"
    tratamento = TratamentoDados(caminho)
    try:
        df = tratamento.carregar_planilha()
        print("\nColunas identificadas:")
        print(df.columns.tolist())
        print("\nAmostra:")
        print(df.head().to_string(index=False))
    except Exception as exc:
        print(f"Erro ao processar a planilha: {exc}")
