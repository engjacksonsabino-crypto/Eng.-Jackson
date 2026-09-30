import os
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import pandas as pd

matplotlib.use("Agg")

from src.analise import calcular_indicadores_gerais
from src.tratamento import GERENCIOU, PARCIAL, PENDENTE, SEM_REGISTRO

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "saidas" / "graficos"
OUT.mkdir(parents=True, exist_ok=True)


def salvar_graficos(indicadores: dict, por_ordem: pd.DataFrame, base_dir: str | Path = OUT):
    base_dir = Path(base_dir)
    base_dir.mkdir(parents=True, exist_ok=True)

    status_data = [
        indicadores["gerenciaram"],
        indicadores["parciais"],
        indicadores["pendentes"],
    ]
    status_labels = ["Gerenciados", "Parciais", "Pendentes"]
    colors = ["#2E7D32", "#F9A825", "#D32F2F"]

    fig, ax = plt.subplots(figsize=(7, 5))
    ax.bar(status_labels, status_data, color=colors)
    ax.set_title("Gerenciados x Parciais x Pendentes")
    ax.set_ylabel("Quantidade")
    for i, v in enumerate(status_data):
        ax.text(i, v + 0.5, str(v), ha="center", va="bottom")
    fig.tight_layout()
    fig.savefig(base_dir / "gerenciados_parciais_pendentes.png", dpi=200)
    plt.close(fig)

    if not por_ordem.empty:
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(por_ordem["ORDEM"], por_ordem["PERCENTUAL_GERENCIAMENTO"], marker="o", linewidth=2.5, color="#1565C0")
        ax.set_title("Evolução do percentual de gerenciamento por Ordem")
        ax.set_ylabel("Percentual (%)")
        ax.set_xlabel("Ordem")
        ax.grid(True, linestyle="--", alpha=0.3)
        fig.tight_layout()
        fig.savefig(base_dir / "evolucao_ordens.png", dpi=200)
        plt.close(fig)

    if not por_ordem.empty:
        fig, ax = plt.subplots(figsize=(9, 5))
        x = range(len(por_ordem))
        ax.bar(x, por_ordem["PENDENTE"], color="#D32F2F")
        ax.set_xticks(list(x))
        ax.set_xticklabels(por_ordem["ORDEM"], rotation=0)
        ax.set_title("Pendências por Ordem")
        ax.set_xlabel("Ordem")
        ax.set_ylabel("Quantidade")
        fig.tight_layout()
        fig.savefig(base_dir / "pendencias_por_ordem.png", dpi=200)
        plt.close(fig)

    return {
        "status": base_dir / "gerenciados_parciais_pendentes.png",
        "evolucao_ordens": base_dir / "evolucao_ordens.png",
        "pendencias_por_ordem": base_dir / "pendencias_por_ordem.png",
    }


__all__ = ["salvar_graficos"]
