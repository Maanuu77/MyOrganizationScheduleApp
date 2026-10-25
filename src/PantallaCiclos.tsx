// Lista de ciclos de estudio guardados como plantillas, con las plantillas de arranque opcionales.
import { useState } from 'react';
import { motion } from 'motion/react';
import { Pencil, Plus, Sparkles, Workflow } from 'lucide-react';
import { useDatos } from './almacenDatos';
import { avisar } from './almacenUI';
import { ciclos as dbCiclos, nuevoId } from './datos';
import { Cabecera } from './Cabecera';
import { Boton } from './Boton';
import { EstadoVacio } from './EstadoVacio';
import { EditorCiclo } from './EditorCiclo';
import { BarraFases } from './BarraFases';
import { duracionTotal, expandirCiclo, focoTotal, plantillasDeArranque } from './ciclos';
import { duracionTexto } from './fechas';
import { t } from './textos';
import type { PlantillaCiclo } from './tipos';

export function PantallaCiclos() {
  const ciclos = useDatos((s) => s.ciclos);
  const [editando, setEditando] = useState<PlantillaCiclo | null>(null);
  const [abierto, setAbierto] = useState(false);

  const abrir = (c: PlantillaCiclo | null) => {
    setEditando(c);
    setAbierto(true);
  };

  const añadirArranque = async () => {
    // Solo añadimos las que no existan ya con el mismo nombre
    const existentes = new Set(ciclos.map((c) => c.nombre));
    const nuevas = plantillasDeArranque(nuevoId).filter((p) => !existentes.has(p.nombre));
    if (nuevas.length) await dbCiclos.crearVarios(nuevas);
    avisar(t.comun.guardado, 'exito');
  };

  return (
    <div>
      <Cabecera
        titulo={t.ciclos.titulo}
        subtitulo={t.ciclos.subtitulo}
        acciones={
          <>
            <Boton
              variante="secundario"
              icono={<Sparkles size={16} />}
              onClick={añadirArranque}
              title={t.ciclos.arranqueTexto}
            >
              {t.ciclos.arranque}
            </Boton>
            <Boton variante="primario" icono={<Plus size={16} />} onClick={() => abrir(null)}>
              {t.ciclos.nuevo}
            </Boton>
          </>
        }
      />
      {ciclos.length === 0 ? (
        <EstadoVacio
          icono={<Workflow size={28} />}
          titulo={t.ciclos.vacioTitulo}
          texto={t.ciclos.arranqueTexto}
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <Boton variante="secundario" icono={<Sparkles size={16} />} onClick={añadirArranque}>
                {t.ciclos.arranque}
              </Boton>
              <Boton variante="primario" icono={<Plus size={16} />} onClick={() => abrir(null)}>
                {t.ciclos.nuevo}
              </Boton>
            </div>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {ciclos.map((c, i) => {
            const fases = expandirCiclo(c);
            return (
              <motion.li
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="tarjeta"
              >
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="flex-1 truncate font-bold">{c.nombre}</h2>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    icono={<Pencil size={14} />}
                    onClick={() => abrir(c)}
                  >
                    {t.comun.editar}
                  </Boton>
                </div>
                <BarraFases fases={fases} />
                <p className="mt-2 text-xs text-texto-suave">
                  {fases.length} fases · {t.ciclos.total(duracionTexto(duracionTotal(fases)))} ·{' '}
                  {duracionTexto(focoTotal(fases))} de foco
                </p>
              </motion.li>
            );
          })}
        </ul>
      )}
      <EditorCiclo abierto={abierto} ciclo={editando} alCerrar={() => setAbierto(false)} />
    </div>
  );
}
