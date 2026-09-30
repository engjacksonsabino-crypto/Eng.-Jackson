import re
from typing import Any, Iterable

import numpy as np
import pandas as pd

SEM_REGISTRO = "SEM REGISTRO"
PENDENTE = "PENDENTE"
GERENCIOU = "GERENCIOU"
PARCIAL = "PARCIAL"


def normalize_text(value: Any) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    text = text.replace("\n", " ").replace("\r", " ")
    text = re.sub(r"\s+", " ", text)
    return text


def limpar_status(valor: Any) -> str:
    text = normalize_text(valor).upper()
    if text in {"", "NAN", "NONE", "NULL", "NA"}:
        return SEM_REGISTRO
    text = text.strip()
    if text in {"X", "*"}:
        return PENDENTE
    if any(token in text for token in ["PENDENTE", "PENDENTES", "AGUARDANDO", "NAO GERENCIADO", "NÃO GERENCIADO"]):
        return PENDENTE
    if any(token in text for token in ["PARCIAL", "PARCIALMENTE", "GERENCIAMENTO PARCIAL", "EM PARCIAL"]):
        return PARCIAL
    if any(token in text for token in ["GERENCIADO", "GERENCIOU", "OK", "REALIZADO", "CONCLUIDO", "ATENDIDO", "FEITO"]):
        return GERENCIOU
    if "X" in text:
        return PENDENTE
    return text if text else SEM_REGISTRO


def normalizar_nome(value: Any) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    text = text.upper()
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalizar_status_tutor(value: Any) -> str:
    text = normalize_text(value).upper()
    if not text or text in {"NAN", "NONE", "NULL", "NA"}:
        return "SEM REGISTRO"
    for termo in ["ATIVO", "NOVO", "DESLIGADO", "TRILHA", "INATIVO", "AFASTADO", "AGRONOMIA"]:
        if termo in text:
            return termo.title()
    return text.title() if text else "SEM REGISTRO"


def garantir_arquivo_xlsx(path: str | None):
    if path is None:
        return None
    return str(path)


def detectar_coluna(df: pd.DataFrame, candidatos: Iterable[str]) -> str | None:
    colunas = {str(col).strip().upper(): col for col in df.columns}
    for padrao in candidatos:
        alvo = padrao.upper()
        for chave, valor in colunas.items():
            if alvo in chave or chave in alvo:
                return valor
    return None


def limpar_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df.copy()

    df = df.copy()
    df.columns = [normalize_text(col) for col in df.columns]
    df = df.replace({np.nan: ""})

    for col in df.columns:
        if df[col].dtype == object:
            df[col] = df[col].map(normalize_text)

    return df


def preparar_dados(planilha: str | None, sheet_name: str | None = None):
    if planilha is None:
        raise FileNotFoundError("Arquivo Excel não informado.")

    excel_file = pd.ExcelFile(planilha)
    sheets = excel_file.sheet_names

    if sheet_name:
        selected = sheet_name
    else:
        selected = "02semestre" if "02semestre" in [s.lower() for s in sheets] else sheets[0]

    df = pd.read_excel(planilha, sheet_name=selected, header=3)
    df = limpar_dataframe(df)

    colunas = {str(c).upper(): c for c in df.columns}

    tutor_col = detectar_coluna(
        df,
        [
            "TUTOR",
            "NOME TUTOR",
            "TUTOR RESPONSAVEL",
            "NOME",
            "NOME DO TUTOR",
            "TUTORES",
            "TUTOR/ALUNO",
            "RESPONSAVEL",
        ],
    )
    if tutor_col is None:
        tutor_col = df.columns[0]

    status_tutor_col = detectar_coluna(
        df,
        [
            "STATUS DO TUTOR",
            "STATUS TUTOR",
            "SITUACAO DO TUTOR",
            "TUTOR STATUS",
            "STATUS",
            "SITUACAO",
            "CATEGORIA",
        ],
    )

    ordem_cols = []
    for col in df.columns:
        col_norm = normalize_text(col).upper()
        if "ORDEM" in col_norm or re.search(r"\b0[1-9]\b", col_norm):
            ordem_cols.append(col)

    dados = df.copy()
    dados["TUTOR"] = dados[tutor_col].map(normalizar_nome)

    if status_tutor_col is not None:
        dados["STATUS_TUTOR"] = dados[status_tutor_col].map(normalizar_status_tutor)
    else:
        dados["STATUS_TUTOR"] = "SEM REGISTRO"

    registros_ordem = []
    for col in ordem_cols:
        ordem_nome = normalize_text(col).upper()
        ordem_label = ordens_label(ordem_nome)
        for _, row in dados[["TUTOR", "STATUS_TUTOR", col]].iterrows():
            registros_ordem.append(
                {
                    "TUTOR": row["TUTOR"],
                    "STATUS_TUTOR": row["STATUS_TUTOR"],
                    "ORDEM": ordem_label,
                    "GERENCIAMENTO": limpar_status(row[col]),
                    "VALOR_ORIGINAL": row[col],
                }
            )

    if not registros_ordem:
        registros_ordem = [
            {
                "TUTOR": row["TUTOR"],
                "STATUS_TUTOR": row["STATUS_TUTOR"],
                "ORDEM": "GERAL",
                "GERENCIAMENTO": limpar_status(row[tutor_col]),
                "VALOR_ORIGINAL": row[tutor_col],
            }
            for _, row in dados[["TUTOR", "STATUS_TUTOR", tutor_col]].iterrows()
        ]

    long = pd.DataFrame(registros_ordem)
    long = long.dropna(subset=["TUTOR"]).copy()
    long["TUTOR"] = long["TUTOR"].map(normalizar_nome)
    long["GERENCIAMENTO"] = long["GERENCIAMENTO"].map(limpar_status)
    long["STATUS_TUTOR"] = long["STATUS_TUTOR"].map(normalizar_status_tutor)
    long = long[long["TUTOR"] != ""].copy()

    return {
        "df": dados,
        "long": long,
        "sheet_name": selected,
        "tutor_col": tutor_col,
        "status_tutor_col": status_tutor_col,
        "ordens": sorted(long["ORDEM"].dropna().unique().tolist()),
    }


def ordens_label(coluna: str) -> str:
    texto = normalize_text(coluna).upper()
    if "ORDEM" in texto:
        numero = re.search(r"0?[1-9]\d*", texto)
        if numero:
            return f"ORDEM {numero.group(0).zfill(2)}"
    if re.search(r"\b0?[1-9]\d*\b", texto):
        numero = re.search(r"\b0?[1-9]\d*\b", texto)
        return f"ORDEM {numero.group(0).zfill(2)}"
    return "GERAL"


__all__ = [
    "normalize_text",
    "limpar_status",
    "normalizar_nome",
    "normalizar_status_tutor",
    "detectar_coluna",
    "limpar_dataframe",
    "preparar_dados",
    "SEM_REGISTRO",
    "PENDENTE",
    "GERENCIOU",
    "PARCIAL",
]
