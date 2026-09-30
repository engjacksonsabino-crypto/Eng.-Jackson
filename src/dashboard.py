import pandas as pd

from src.tratamento import GERENCIOU, PARCIAL, PENDENTE, SEM_REGISTRO


def calcular_indicadores_gerais(long: pd.DataFrame):
    if long.empty:
        return {
            "total_tutores": 0,
            "gerenciaram": 0,
            "pendentes": 0,
            "parciais": 0,
            "sem_registro": 0,
            "percentual_gerenciou": 0.0,
            "percentual_pendente": 0.0,
            "percentual_parcial": 0.0,
            "percentual_sem_registro": 0.0,
        }

    total = long["TUTOR"].nunique()
    gerenciaram = long[long["GERENCIAMENTO"] == GERENCIOU]["TUTOR"].nunique()
    pendentes = long[long["GERENCIAMENTO"] == PENDENTE]["TUTOR"].nunique()
    parciais = long[long["GERENCIAMENTO"] == PARCIAL]["TUTOR"].nunique()
    sem_registro = long[long["GERENCIAMENTO"] == SEM_REGISTRO]["TUTOR"].nunique()

    def pct(valor):
        return round((valor / total) * 100, 2) if total else 0.0

    return {
        "total_tutores": int(total),
        "gerenciaram": int(gerenciaram),
        "pendentes": int(pendentes),
        "parciais": int(parciais),
        "sem_registro": int(sem_registro),
        "percentual_gerenciou": pct(gerenciaram),
        "percentual_pendente": pct(pendentes),
        "percentual_parcial": pct(parciais),
        "percentual_sem_registro": pct(sem_registro),
    }


def calcular_por_ordem(long: pd.DataFrame):
    if long.empty:
        return pd.DataFrame(columns=["ORDEM", "TOTAL", "GERENCIOU", "PARCIAL", "PENDENTE", "SEM REGISTRO", "PERCENTUAL_GERENCIAMENTO"])

    tabela = (
        long.groupby("ORDEM")
        .agg(
            total=("TUTOR", "nunique"),
            gerenciou=("GERENCIAMENTO", lambda s: s.eq(GERENCIOU).groupby(long.loc[s.index, "TUTOR"]).any().sum()),
        )
    )

    # Recalcular com lógica correta por tutor-origem por ordem
    registros = []
    for ordem, grupo in long.groupby("ORDEM"):
        tutores = grupo["TUTOR"].drop_duplicates()
        total = tutores.nunique()
        gerenciou = grupo[groupo := grupo["GERENCIAMENTO"] == GERENCIOU]["TUTOR"].nunique()
        parcial = grupo[grupo["GERENCIAMENTO"] == PARCIAL]["TUTOR"].nunique()
        pendente = grupo[grupo["GERENCIAMENTO"] == PENDENTE]["TUTOR"].nunique()
        sem_registro = grupo[grupo["GERENCIAMENTO"] == SEM_REGISTRO]["TUTOR"].nunique()
        registros.append(
            {
                "ORDEM": ordem,
                "TOTAL": int(total),
                "GERENCIOU": int(gerenciou),
                "PARCIAL": int(parcial),
                "PENDENTE": int(pendente),
                "SEM REGISTRO": int(sem_registro),
                "PERCENTUAL_GERENCIAMENTO": round((gerenciou / total) * 100, 2) if total else 0.0,
            }
        )

    return pd.DataFrame(registros).sort_values("ORDEM").reset_index(drop=True)


def calcular_por_tutor(long: pd.DataFrame):
    if long.empty:
        return pd.DataFrame(columns=["TUTOR", "STATUS_TUTOR", "ORDEM", "GERENCIAMENTO"])

    tabela = long[["TUTOR", "STATUS_TUTOR", "ORDEM", "GERENCIAMENTO"]].copy()
    tabela = tabela.drop_duplicates().sort_values(["TUTOR", "ORDEM"]).reset_index(drop=True)
    return tabela


def situacao_tutores(long: pd.DataFrame):
    if long.empty:
        return pd.Series(dtype="object")

    resumo = long.drop_duplicates(subset=["TUTOR", "ORDEM"]).copy()
    status = resumo.groupby("TUTOR")["GERENCIAMENTO"].apply(lambda s: "PENDENTE" if s.eq(PENDENTE).all() else "GERENCIOU" if s.eq(GERENCIOU).all() else "PARCIAL" if s.eq(PARCIAL).any() else "SEM REGISTRO")
    return status


__all__ = [
    "calcular_indicadores_gerais",
    "calcular_por_ordem",
    "calcular_por_tutor",
    "situacao_tutores",
]
