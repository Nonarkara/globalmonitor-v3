"""Shared figure style: Rams palette (one accent), serif text to match the paper."""
import matplotlib as mpl
INK, INK2, INK3, LINE, GREEN, RED = "#191712", "#6f6c63", "#a9a59a", "#d2cfc5", "#1f6e43", "#a23a26"
def apply():
    mpl.rcParams.update({
        "font.family": "serif", "font.serif": ["STIXGeneral"], "mathtext.fontset": "stix",
        "font.size": 7.5, "axes.titlesize": 8, "axes.labelsize": 7.5, "xtick.labelsize": 6.8, "ytick.labelsize": 6.8,
        "legend.fontsize": 6.8, "axes.edgecolor": INK2, "axes.linewidth": 0.5, "xtick.color": INK2, "ytick.color": INK2,
        "xtick.major.width": 0.5, "ytick.major.width": 0.5, "xtick.major.size": 2.5, "ytick.major.size": 2.5,
        "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.color": "#e7e5dd", "grid.linewidth": 0.4,
        "axes.axisbelow": True, "legend.frameon": False, "pdf.fonttype": 42, "savefig.bbox": "tight", "savefig.pad_inches": 0.03,
        "figure.dpi": 150, "lines.linewidth": 1.0,
    })
