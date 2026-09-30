from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "dados"
OUTPUT_DIR = ROOT / "saidas"
GRAPH_DIR = OUTPUT_DIR / "graficos"
REPORT_DIR = OUTPUT_DIR / "relatorios"

__all__ = ["ROOT", "DATA_DIR", "OUTPUT_DIR", "GRAPH_DIR", "REPORT_DIR"]
