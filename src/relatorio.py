"""Módulo de análise dos dados de controle de tutoria."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

try:
    from src.tratamento import TratamentoDados
except ImportError:
    from tratamento import TratamentoDados


class AnaliseTutores:
    """Responsável por calcular indicadores e analisar a planilha."""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self._ordens = self.identificar_ordens()

    def identificar_ordens(self) -> List[str]:
        """Identifica as colunas que representam ordens de gerenciamento."""
        colunas = []
        for coluna in self.df.columns:
            texto = str(coluna).upper()
            if "ORDEM" in texto or "ORD" in texto:
                colunas.append(coluna)
        return colunas

    def status_por_tutor(self) -> pd.DataFrame:
        """Retorna uma tabela com o histórico de cada tutor por ordem."""
        if not self._ordens:
            return self.df[[self.df.columns[0]]].rename(columns={self.df.columns[0]: "Tutor"})

        tabela = self.df[[self.df.columns[0]]].copy()
        tabela.columns = ["Tutor"]

        for ordem in self._ordens:
            tabela[ordem] = self.df[ordem].apply(TratamentoDados.limpar_status)

        if self._ordens:
            tabela["SITUACAO_ATUAL"] = self.df[self._ordens[-1]].apply(TratamentoDados.limpar_status)

        return tabela

    def calcular_indicadores_gerais(self) -> Dict[str, Any]:
        """Calcula indicadores gerais do total de tutores."""
        if self.df.empty:
            return {
                "total_tutores": 0,
                "gerenciaram": 0,
                "parcial": 0,
                "pendentes": 0,
                "sem_registro": 0,
                "percentual_gerenciamento": 0.0,
                "percentual_parcial": 0.0,
                "percentual_pendente": 0.0,
                "percentual_sem_registro": 0.0,
            }

        total = len(self.df)
        status = []
        for ordem in self._ordens:
            status.append(self.df[ordem].apply(TratamentoDados.limpar_status))

        if status:
            conjunto = pd.concat(status, ignore_index=True)
            gerenciaram = (conjunto == "GERENCIA").sum()
            parcial = (conjunto == "PARCIAL").sum()
            pendentes = (conjunto == "PENDENTE").sum()
            sem_registro = (conjunto == "SEM REGISTRO").sum()
        else:
            gerenciaram = 0
            parcial = 0
            pendentes = 0
            sem_registro = 0

        return {
            "total_tutores": total,
            "gerenciaram": int(gerenciaram),
            "parcial": int(parcial),
            "pendentes": int(pendentes),
            "sem_registro": int(sem_registro),
            "percentual_gerenciamento": round((gerenciaram / total) * 100, 2) if total else 0.0,
            "percentual_parcial": round((parcial / total) * 100, 2) if total else 0.0,
            "percentual_pendente": round((pendentes / total) * 100, 2) if total else 0.0,
            "percentual_sem_registro": round((sem_registro / total) * 100, 2) if total else 0.0,
        }

    def analise_por_ordem(self, ordem: str) -> Dict[str, Any]:
        """Analisa uma ordem específica."""
        if ordem not in self.df.columns:
            raise KeyError(f"Ordem '{ordem}' não encontrada no DataFrame.")

        serie = self.df[ordem].apply(TratamentoDados.limpar_status)
        total = len(self.df)
        gerenciaram = int((serie == "GERENCIA").sum())
        pendentes = int((serie == "PENDENTE").sum())
        sem_registro = int((serie == "SEM REGISTRO").sum())
        parcial = int(total - gerenciaram - pendentes - sem_registro)

        return {
            "ordem": ordem,
            "total_tutores": total,
            "gerenciaram": gerenciaram,
            "parcial": parcial,
            "pendentes": pendentes,
            "sem_registro": sem_registro,
            "percentual_gerenciamento": round((gerenciaram / total) * 100, 2) if total else 0.0,
            "percentual_parcial": round((parcial / total) * 100, 2) if total else 0.0,
            "percentual_pendente": round((pendentes / total) * 100, 2) if total else 0.0,
            "percentual_sem_registro": round((sem_registro / total) * 100, 2) if total else 0.0,
        }

    def comparativo_ordens(self) -> pd.DataFrame:
        """Retorna uma tabela comparando todas as ordens."""
        registros = []
        for ordem in self._ordens:
            registros.append(self.analise_por_ordem(ordem))
        return pd.DataFrame(registros)

    def gerar_resumo_texto(self) -> str:
        """Gera um resumo textual da análise."""
        indicadores = self.calcular_indicadores_gerais()
        linhas = [
            "Resumo da análise da planilha de controle de tutoria",
            "=" * 60,
            f"Total de tutores: {indicadores['total_tutores']}",
            f"Gerenciaram: {indicadores['gerenciaram']} ({indicadores['percentual_gerenciamento']}%)",
            f"Parcial: {indicadores['parcial']} ({indicadores['percentual_parcial']}%)",
            f"Pendentes: {indicadores['pendentes']} ({indicadores['percentual_pendente']}%)",
            f"Sem registro: {indicadores['sem_registro']} ({indicadores['percentual_sem_registro']}%)",
            "",
            "Comparativo por ordem:",
        ]

        comparativo = self.comparativo_ordens()
        for _, row in comparativo.iterrows():
            linhas.append(
                f"- {row['ordem']}: gerenciaram={row['gerenciaram']}, "
                f"parcial={row['parcial']}, pendentes={row['pendentes']}, "
                f"sem_registro={row['sem_registro']}"
            )

        return "\n".join(linhas)


if __name__ == "__main__":
    caminho = Path(__file__).resolve().parents[1] / "dados" / "GERENCIAMENTO CONTROLE JACKSON.xlsx"
    tratamento = TratamentoDados(caminho)
    try:
        df = tratamento.carregar_planilha()
        df = tratamento.processar_dados()
        analise = AnaliseTutores(df)
        print(analise.gerar_resumo_texto())
        print("\nTabelas por ordem:")
        print(analise.comparativo_ordens().to_string(index=False))
    except Exception as exc:
        print(f"Erro ao executar análise: {exc}")
