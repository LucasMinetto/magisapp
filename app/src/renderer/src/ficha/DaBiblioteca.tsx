// Trazer itens e rituais da biblioteca para dentro da ficha (aba Inventário e aba Rituais).
// A ficha recebe uma cópia; ela continua na ficha mesmo se o registro sair da biblioteca.
import { Check, Library, Plus } from "lucide-react";
import { useState } from "react";
import { itemParaFicha, ritualParaFicha } from "@shared/ordem/biblioteca";
import { ELEMENTOS } from "@shared/ordem/esquemas";
import type { LibraryEntry } from "@shared/types";
import { Button, Dialog, ErrorNote, SelectField, TextField } from "@/ui";
import { useLoad } from "@/lib/data";
import { resumoItem } from "@/biblioteca/Item";
import { ROMANO } from "@/biblioteca/Ritual";
import { novoId, useFicha } from "./contexto";

type Tipo = "item" | "ritual";

export function BotaoDaBiblioteca({ tipo }: { tipo: Tipo }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        icon={<Library className="size-4" />}
        onClick={() => setAberto(true)}
      >
        Da biblioteca
      </Button>
      {aberto && <DaBiblioteca tipo={tipo} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function DaBiblioteca({
  tipo,
  aoFechar,
}: {
  tipo: Tipo;
  aoFechar: () => void;
}) {
  const { a, alterar } = useFicha();
  const [q, setQ] = useState("");
  const [fonte, setFonte] = useState("");
  const [elemento, setElemento] = useState("");
  const fontes = useLoad(() => window.api.library.sources(), []);
  const lista = useLoad(
    () =>
      window.api.library.list({
        kind: tipo,
        q: q.trim() || undefined,
        sourceId: fonte || undefined,
      }),
    [tipo, q, fonte],
  );
  // ids da biblioteca que já estão na ficha (para marcar "na ficha")
  const naFicha = new Set(
    (tipo === "item" ? a.inventario : a.rituais)
      .map((x) => x.origem?.libraryId)
      .filter(Boolean),
  );
  const registros = (lista.data ?? []).filter(
    (e) => !elemento || (e.data as { elemento?: string }).elemento === elemento,
  );

  const adicionar = (e: LibraryEntry) => {
    if (tipo === "item")
      alterar({
        inventario: [
          ...a.inventario,
          itemParaFicha(e as LibraryEntry<"item">, novoId()),
        ],
      });
    else
      alterar({
        rituais: [
          ...a.rituais,
          ritualParaFicha(e as LibraryEntry<"ritual">, novoId()),
        ],
      });
  };
  const resumo = (e: LibraryEntry) => {
    if (tipo === "item") return resumoItem((e as LibraryEntry<"item">).data);
    const r = (e as LibraryEntry<"ritual">).data;
    return [
      r.elemento,
      `${ROMANO[r.circulo] ?? r.circulo}º círculo`,
      r.danoNormal,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && aoFechar()}
      title={tipo === "item" ? "Itens da biblioteca" : "Rituais da biblioteca"}
      description="A ficha recebe uma cópia, que você pode editar sem mudar a biblioteca."
      footer={<Button onClick={aoFechar}>Pronto</Button>}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="Buscar"
            placeholder={tipo === "item" ? "Faca, colete…" : "Eletrocussão…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="col-span-2"
            autoFocus
          />
          <SelectField
            label="Origem"
            empty="Todas as origens"
            value={fonte}
            onChange={(e) => setFonte(e.target.value)}
            options={(fontes.data ?? []).map((s) => ({
              value: s.id,
              label: s.name,
            }))}
          />
          <SelectField
            label="Elemento"
            empty="Todos os elementos"
            value={elemento}
            onChange={(e) => setElemento(e.target.value)}
            options={ELEMENTOS.map((x) => ({ value: x, label: x }))}
          />
        </div>
        {lista.error && <ErrorNote message={lista.error} />}
        {lista.data && registros.length === 0 && (
          <p className="text-sm text-muted">Nada encontrado.</p>
        )}
        <ul
          className="flex max-h-[50vh] flex-col gap-1 overflow-y-auto"
          aria-label="Registros da biblioteca"
        >
          {registros.map((e) => {
            const tem = naFicha.has(e.id);
            return (
              <li
                key={e.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{e.name}</div>
                  <div className="truncate text-xs text-subtle">
                    {resumo(e)}
                    {resumo(e) && " · "}
                    {e.sourceName}
                  </div>
                </div>
                {tem && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check className="size-3.5" aria-hidden /> na ficha
                  </span>
                )}
                <Button
                  size="sm"
                  variant={tem ? "ghost" : "primary"}
                  icon={<Plus className="size-4" />}
                  aria-label={`Adicionar ${e.name}`}
                  onClick={() => adicionar(e)}
                >
                  {tem ? "Mais um" : "Adicionar"}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
