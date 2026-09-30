import pandas as pd


def gerar_relatorio_gerencial(indicadores: dict, por_ordem: pd.DataFrame, pendencias: pd.DataFrame | None = None) -> str:
    linhas = []
    linhas.append("RELATÓRIO GERENCIAL - CONTROLE DE TUTORES")
    linhas.append("=" * 60)
    linhas.append(f"Total de tutores: {indicadores.get('total_tutores', 0)}")
    linhas.append(f"Gerenciaram: {indicadores.get('gerenciaram', 0)} ({indicadores.get('percentual_gerenciou', 0.0)}%)")
    linhas.append(f"Pendentes: {indicadores.get('pendentes', 0)} ({indicadores.get('percentual_pendente', 0.0)}%)")
    linhas.append(f"Gerenciamento parcial: {indicadores.get('parciais', 0)} ({indicadores.get('percentual_parcial', 0.0)}%)")
    linhas.append(f"Sem registro: {indicadores.get('sem_registro', 0)} ({indicadores.get('percentual_sem_registro', 0.0)}%)")
    linhas.append("")
    linhas.append("Evolução por ordem:")

    if not por_ordem.empty:
        for _, row in por_ordem.iterrows():
            linhas.append(
                f"- {row['ORDEM']}: {row['GERENCIOU']} gerenciados | {row['PARCIAL']} parciais | {row['PENDENTE']} pendentes | "
                f"{row['PERCENTUAL_GERENCIAMENTO']}% de gerenciamento"
            )
    else:
        linhas.append("- Dados das ordens indisponíveis.")

    if pendencias is not None and not pendencias.empty:
        linhas.append("")
        linhas.append("Principais pontos de atenção:")
        for _, row in pendencias.head(5).iterrows():
            linhas.append(f"- {row['ORDEM']}: {row['PENDENTE']} pendências")

    linhas.append("")
    linhas.append("Observações:")
    linhas.append("- O relatório foi baseado exclusivamente nos dados presentes na planilha.")
    linhas.append("- Quando houver inconsistência, os registros foram normalizados e categorizados conforme as regras do processo.")
    return "\n".join(linhas)


__all__ = ["gerar_relatorio_gerencial"]
