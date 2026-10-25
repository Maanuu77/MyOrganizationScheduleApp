// Editor de ciclos de estudio (flujo de foco y descanso). Lo usan la pantalla de ciclos
// y las rutinas de estudio.

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Boton } from './Boton';
import { Campo } from './Campos';
import { BarraFases } from './BarraFases';
import { COLORES_FASE, NOMBRES_FASE, duracionTotal, expandirCiclo, nuevaFase } from './ciclos';
import { ciclos as dbCiclos, nuevoId } from './datos';
import { avisar, confirmar } from './almacenUI';
import { duracionTexto } from './fechas';
import { t } from './textos';
import type { Fase, PlantillaCiclo, TipoFase } from './tipos';

interface Props {
  abierto: boolean;
  ciclo: PlantillaCiclo | null;
  alCerrar: (creado?: PlantillaCiclo) => void;
}

export function EditorCiclo({ abierto, ciclo, alCerrar }: Props) {
  const [nombre, setNombre] = useState('');
  const [fases, setFases] = useState<Fase[]>([]);
  const [repeticiones, setRepeticiones] = useState(4);
  const [cada, setCada] = useState(0);
  const [largoMin, setLargoMin] = useState(15);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setNombre(ciclo?.nombre ?? '');
    setFases(
      ciclo?.fases ?? [nuevaFase('foco', 25, nuevoId()), nuevaFase('descansoCorto', 5, nuevoId())],
    );
    setRepeticiones(ciclo?.repeticiones ?? 4);
    setCada(ciclo?.descansoLargoCada ?? 0);
    setLargoMin(ciclo?.descansoLargoMin ?? 15);
  }, [abierto, ciclo]);

  const vista = useMemo(
    () =>
      expandirCiclo({
        fases,
        repeticiones,
        descansoLargoCada: cada || null,
        descansoLargoMin: largoMin,
      }),
    [fases, repeticiones, cada, largoMin],
  );

  const cambiarFase = (id: string, cambios: Partial<Fase>) =>
    setFases(fases.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  const moverFase = (i: number, d: -1 | 1) => {
    const copia = [...fases];
    const [f] = copia.splice(i, 1);
    copia.splice(i + d, 0, f);
    setFases(copia);
  };

  const guardar = async () => {
    const limpio = nombre.trim() || 'Mi ciclo';
    if (!fases.length) return;
    setGuardando(true);
    const datos = {
      nombre: limpio,
      fases: fases.map((f) => ({
        ...f,
        nombre: f.nombre.trim() || NOMBRES_FASE[f.tipo],
        duracionMin: Math.max(1, Math.min(600, Math.round(f.duracionMin))),
      })),
      repeticiones: Math.max(1, Math.min(20, repeticiones)),
      descansoLargoCada: cada > 0 ? cada : null,
      descansoLargoMin: Math.max(1, Math.min(180, largoMin)),
    };
    try {
      if (ciclo) {
        await dbCiclos.actualizar(ciclo.id, datos);
        alCerrar();
      } else {
        alCerrar(await dbCiclos.crear(datos));
      }
    } catch (e) {
      console.error(e);
      avisar(t.comun.error, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async () => {
    if (!ciclo) return;
    if (
      !(await confirmar({
        titulo: t.ciclos.borrarTitulo,
        mensaje: `«${ciclo.nombre}»`,
        textoConfirmar: t.comun.borrar,
        peligro: true,
      }))
    )
      return;
    await dbCiclos.borrar(ciclo.id);
    alCerrar();
  };

  return (
    <Modal
      abierto={abierto}
      alCerrar={() => alCerrar()}
      titulo={ciclo ? t.ciclos.editar : t.ciclos.nuevo}
      ancho="lg"
      pie={
        <>
          {ciclo && (
            <Boton
              variante="fantasma"
              tamano="icono"
              className="mr-auto"
              onClick={borrar}
              aria-label={t.comun.borrar}
            >
              <Trash2 size={18} className="text-peligro" />
            </Boton>
          )}
          <Boton variante="fantasma" onClick={() => alCerrar()}>
            {t.comun.cancelar}
          </Boton>
          <Boton variante="primario" onClick={guardar} cargando={guardando}>
            {t.comun.guardar}
          </Boton>
        </>
      }
    >
      <div className="space-y-5">
        <Campo etiqueta={t.comun.nombre}>
          {(id) => (
            <input
              id={id}
              className="campo"
              value={nombre}
              maxLength={60}
              placeholder="Mi ciclo"
              onChange={(e) => setNombre(e.target.value)}
              data-autofoco
            />
          )}
        </Campo>

        <div>
          <p className="etiqueta-campo">{t.ciclos.fases}</p>
          <ol className="space-y-2">
            {fases.map((f, i) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-borde bg-superficie-2/50 p-2"
              >
                <input
                  type="color"
                  value={f.color}
                  onChange={(e) => cambiarFase(f.id, { color: e.target.value })}
                  className="h-8 w-8 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  aria-label={t.comun.color}
                />
                <select
                  className="campo w-auto py-1.5"
                  value={f.tipo}
                  aria-label="Tipo de fase"
                  onChange={(e) => {
                    const tipo = e.target.value as TipoFase;
                    cambiarFase(f.id, {
                      tipo,
                      color: COLORES_FASE[tipo],
                      nombre: f.nombre === NOMBRES_FASE[f.tipo] ? NOMBRES_FASE[tipo] : f.nombre,
                    });
                  }}
                >
                  {(Object.keys(t.ciclos.tipos) as TipoFase[]).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {t.ciclos.tipos[tipo]}
                    </option>
                  ))}
                </select>
                <input
                  className="campo min-w-0 flex-1 py-1.5"
                  value={f.nombre}
                  maxLength={40}
                  aria-label={t.comun.nombre}
                  onChange={(e) => cambiarFase(f.id, { nombre: e.target.value })}
                />
                <label className="flex items-center gap-1 text-sm text-texto-suave">
                  <input
                    type="number"
                    min={1}
                    max={600}
                    className="campo w-20 py-1.5"
                    value={f.duracionMin}
                    aria-label={`${t.comun.duracion} (${t.comun.minutos})`}
                    onChange={(e) =>
                      cambiarFase(f.id, { duracionMin: Number(e.target.value) || 1 })
                    }
                  />
                  min
                </label>
                <div className="flex">
                  <Boton
                    variante="fantasma"
                    tamano="icono"
                    className="h-8 w-8"
                    disabled={i === 0}
                    onClick={() => moverFase(i, -1)}
                    aria-label="Subir fase"
                  >
                    <ArrowUp size={15} />
                  </Boton>
                  <Boton
                    variante="fantasma"
                    tamano="icono"
                    className="h-8 w-8"
                    disabled={i === fases.length - 1}
                    onClick={() => moverFase(i, 1)}
                    aria-label="Bajar fase"
                  >
                    <ArrowDown size={15} />
                  </Boton>
                  <Boton
                    variante="fantasma"
                    tamano="icono"
                    className="h-8 w-8"
                    disabled={fases.length === 1}
                    onClick={() => setFases(fases.filter((x) => x.id !== f.id))}
                    aria-label={t.comun.borrar}
                  >
                    <Trash2 size={15} className="text-peligro" />
                  </Boton>
                </div>
              </li>
            ))}
          </ol>
          <Boton
            variante="suave"
            tamano="sm"
            className="mt-2"
            icono={<Plus size={14} />}
            onClick={() => setFases([...fases, nuevaFase('foco', 25, nuevoId())])}
          >
            {t.ciclos.añadirFase}
          </Boton>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta={t.ciclos.repeticiones}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={20}
                className="campo"
                value={repeticiones}
                onChange={(e) => setRepeticiones(Number(e.target.value) || 1)}
              />
            )}
          </Campo>
          <Campo etiqueta={`${t.ciclos.descansoLargoCada} (${t.ciclos.focos})`} ayuda="0 = nunca">
            {(id) => (
              <input
                id={id}
                type="number"
                min={0}
                max={20}
                className="campo"
                value={cada}
                onChange={(e) => setCada(Math.max(0, Number(e.target.value) || 0))}
              />
            )}
          </Campo>
          <Campo etiqueta={`${t.ciclos.descansoLargoMin} (${t.comun.minutos})`}>
            {(id) => (
              <input
                id={id}
                type="number"
                min={1}
                max={180}
                className="campo"
                value={largoMin}
                disabled={!cada}
                onChange={(e) => setLargoMin(Number(e.target.value) || 1)}
              />
            )}
          </Campo>
        </div>

        <div className="rounded-md bg-superficie-2/60 p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">{t.ciclos.vistaPrevia}</span>
            <span className="text-texto-suave">
              {t.ciclos.total(duracionTexto(duracionTotal(vista)))}
            </span>
          </div>
          <BarraFases fases={vista} />
        </div>
      </div>
    </Modal>
  );
}
