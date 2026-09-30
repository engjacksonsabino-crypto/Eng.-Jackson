"""Módulo de geração do relatório executivo."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import pandas as pd

try:
    from src.analise import AnaliseTutores
    from src.tratamento import TratamentoDados
except ImportError:
    from analise import AnaliseTutores
    from tratamento import TratamentoDados


class RelatorioGerencial:
    """Gera um relatório resumido para gestão."""

    def __init__(self, df: pd.DataFrame):
        self.analise = AnaliseTutores(df)

    def gerar_dict(self) -> Dict[str, Any]:
        indicadores = self.analise.calcular_indicadores_gerais()
        comparativo = self.analise.comparativo_ordens()

        return {
            "indicadores_gerais": indicadores,
            "comparativo_ordens": comparativo.to_dict(orient="records"),
            "resumo_texto": self.analise.gerar_resumo_texto(),
        }

    def exportar_txt(self, caminho_saida: str | Path):
        caminho = Path(caminho_saida)
        caminho.parent.mkdir(parents=True, exist_ok=True)
        caminho.write_text(self.analise.gerar_resumo_texto(), encoding="utf-8")
        print(f"Relatório exportado para: {caminho}")


if __name__ == "__main__":
    caminho = Path(__file__).resolve().parents[1] / "dados" / "GERENCIAMENTO CONTROLE JACKSON.xlsx"
    tratamento = TratamentoDados(caminho)
    try:
        df = tratamento.carregar_planilha()
        df = tratamento.processar_dados()
        relatorio = RelatorioGerencial(df)
        print(relatorio.gerar_dict()["resumo_texto"])
    except Exception as exc:
        print(f"Erro ao gerar relatório: {exc}")
