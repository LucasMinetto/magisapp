#!/usr/bin/env python3
"""Gera tokens.css e tailwind.css a partir de tokens.json. Só biblioteca padrão.

    python build_tokens.py                          # lê tokens.json ao lado deste arquivo
    python build_tokens.py ../../app/src/renderer/src  # também escreve theme.css no app

tokens.css   variáveis CSS (--color-bg, --space-4, --text-sm...), para qualquer CSS
tailwind.css bloco @theme do Tailwind v4: bg-surface, text-muted, rounded-md, text-sm...
Rodar de novo depois de cada mudança em tokens.json.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def px(n):
    return "0" if n == 0 else "%gpx" % n


def main():
    with open(os.path.join(HERE, "tokens.json"), encoding="utf-8") as fh:
        t = json.load(fh)

    css = ["/* Gerado por build_tokens.py a partir de tokens.json. Não editar à mão. */", ":root {"]
    css.append("  color-scheme: dark;")
    for name, value in t["color"].items():
        css.append("  --color-%s: %s;" % (name, value))
    for name, value in t["font"].items():
        css.append("  --font-%s: %s;" % (name, value))
    for name, spec in t["type"].items():
        css.append("  --text-%s: %s;" % (name, px(spec["size"])))
        css.append("  --text-%s--line-height: %s;" % (name, px(spec["line"])))
        css.append("  --text-%s--font-weight: %s;" % (name, spec["weight"]))
        if "tracking" in spec:
            css.append("  --text-%s--letter-spacing: %s;" % (name, spec["tracking"]))
    for i, value in enumerate(t["space"]):
        css.append("  --space-%d: %s;" % (i, px(value)))
    for name, value in t["radius"].items():
        css.append("  --radius-%s: %s;" % (name, px(value)))
    for name, value in t["shadow"].items():
        css.append("  --shadow-%s: %s;" % (name, value))
    css.append("  --duration-fast: %s;" % t["motion"]["fast"])
    css.append("  --duration-base: %s;" % t["motion"]["base"])
    css.append("  --ease-out: %s;" % t["motion"]["ease"])
    for name, value in t["layout"].items():
        if isinstance(value, (int, float)):
            css.append("  --layout-%s: %s;" % (name, px(value)))
    css.append("}")

    # Tipos com fonte ou caixa próprias viram classes utilitárias (.type-label, .type-display...)
    for name, spec in t["type"].items():
        rules = []
        if "font" in spec:
            rules.append("font-family: var(--font-%s);" % spec["font"])
        if spec.get("case") == "uppercase":
            rules.append("text-transform: uppercase;")
        if rules:
            css.append(".type-%s { font-size: var(--text-%s); line-height: var(--text-%s--line-height); "
                       "font-weight: var(--text-%s--font-weight);%s %s }" % (
                           name, name, name, name,
                           " letter-spacing: var(--text-%s--letter-spacing);" % name if "tracking" in spec else "",
                           " ".join(rules)))

    with open(os.path.join(HERE, "tokens.css"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(css) + "\n")

    # Tailwind v4: valores literais no @theme. (Apontar para var(--color-bg) com o mesmo nome criaria um ciclo.)
    tw = ["/* Gerado por build_tokens.py a partir de tokens.json. Não editar à mão. */",
          "/* Uso: @import \"tailwindcss\"; @import \"./theme.css\"; */",
          "@theme {",
          "  --color-*: initial;",
          "  --color-white: #fff;",
          "  --color-black: #000;",
          "  --color-transparent: transparent;",
          "  --color-current: currentColor;"]
    for name, value in t["color"].items():
        tw.append("  --color-%s: %s;" % (name, value))
        # apelidos curtos: text-muted em vez de text-text-muted, text-fg para o texto principal
        if name.startswith("text-"):
            tw.append("  --color-%s: %s;" % (name[len("text-"):], value))
        elif name == "text":
            tw.append("  --color-fg: %s;" % value)
    for name, value in t["font"].items():
        tw.append("  --font-%s: %s;" % (name, value))
    for name, spec in t["type"].items():
        tw.append("  --text-%s: %s;" % (name, px(spec["size"])))
        tw.append("  --text-%s--line-height: %s;" % (name, px(spec["line"])))
        tw.append("  --text-%s--font-weight: %s;" % (name, spec["weight"]))
        if "tracking" in spec:
            tw.append("  --text-%s--letter-spacing: %s;" % (name, spec["tracking"]))
    tw.append("  --spacing: 4px;")
    for name, value in t["radius"].items():
        tw.append("  --radius-%s: %s;" % (name, px(value)))
    for name, value in t["shadow"].items():
        tw.append("  --shadow-%s: %s;" % (name, value))
    tw.append("  --ease-out: %s;" % t["motion"]["ease"])
    tw.append("  --duration-fast: %s;" % t["motion"]["fast"])
    tw.append("  --duration-base: %s;" % t["motion"]["base"])
    for name, value in t["layout"].items():
        if isinstance(value, (int, float)):
            tw.append("  --layout-%s: %s;" % (name, px(value)))
    tw.append("}")
    # Tema claro: os mesmos nomes, outros valores. O Tailwind usa var(--color-*), então trocar aqui troca tudo.
    if "color-light" in t:
        tw.append(':root[data-theme="light"] {')
        for name, value in t["color-light"].items():
            tw.append("  --color-%s: %s;" % (name, value))
            if name.startswith("text-"):
                tw.append("  --color-%s: %s;" % (name[len("text-"):], value))
            elif name == "text":
                tw.append("  --color-fg: %s;" % value)
        tw.append("  color-scheme: light;")
        tw.append("}")
    # Estilos de texto com fonte ou caixa própria viram utilitários: class="type-label"
    for name, spec in t["type"].items():
        rules = ["font-size: %s;" % px(spec["size"]), "line-height: %s;" % px(spec["line"]), "font-weight: %s;" % spec["weight"]]
        if "tracking" in spec:
            rules.append("letter-spacing: %s;" % spec["tracking"])
        if "font" in spec:
            rules.append("font-family: var(--font-%s);" % spec["font"])
        if spec.get("case") == "uppercase":
            rules.append("text-transform: uppercase;")
        tw.append("@utility type-%s { %s }" % (name, " ".join(rules)))
    theme = "\n".join(tw) + "\n"
    with open(os.path.join(HERE, "tailwind.css"), "w", encoding="utf-8") as fh:
        fh.write(theme)
    for out in sys.argv[1:]:
        with open(os.path.join(out, "theme.css"), "w", encoding="utf-8") as fh:
            fh.write(theme)
        print("theme.css escrito em", out)
    print("tokens.css e tailwind.css gerados: %d cores, %d tipos" % (len(t["color"]), len(t["type"])))


if __name__ == "__main__":
    main()
