import { Callout, Checks, Crosses, Section } from "../layout";
import type { Strategy } from "../types";

export const scalpingAbsorption: Strategy = {
  id: "scalping-absorption",
  title: "Scalping de absorción",
  category: "microstructure",
  difficulty: "avanzado",
  norRelevance: "media",
  oneLiner:
    "Detectás un nivel que absorbe agresión sostenida sin romperse. Operás del lado del absorbedor.",
  shortDescription:
    "Identificás un participante grande comprando/vendiendo en un mismo nivel. Vas con él, no contra él.",
  content: (
    <>
      <Callout tone="insight" title="La idea en una línea">
        Cuando alguien con tamaño grande está dispuesto a comer todo lo
        que le tiren a un mismo precio, eso es <strong>absorción</strong>.
        El lado contrario va a fallar y va a haber un movimiento corto en
        la dirección del absorbedor.
      </Callout>

      <Section title="Qué es y por qué importa">
        <p>
          En un book sano, cuando llega una orden agresiva grande, "barre"
          uno o varios niveles: el size del top of book desaparece y el
          precio se mueve. En cambio, en una absorción el size del top no
          desaparece — se{" "}
          <strong>repone constantemente</strong> aunque le sigan pegando.
          Eso indica un participante institucional con orden iceberg
          (tamaño oculto) o muchos tickets a ese precio.
        </p>
        <p>
          La intuición operativa: si vos vendés agresivo y el bid se
          repone una y otra vez, eventualmente te quedás sin munición y el
          precio rebota.
        </p>
      </Section>

      <Section title="Cómo se ejecuta">
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            En el <strong>DOM L2</strong>, identificá un nivel con barra
            visiblemente más grande que los vecinos (wall).
          </li>
          <li>
            Observá si ese nivel recibe agresiones (flash bear en el bid /
            flash bull en el ask) pero su size se mantiene o se repone (la
            barra no se acorta).
          </li>
          <li>
            Confirmá con la <strong>imbalance bar</strong>: si la presión
            agresiva viene del lado opuesto pero el nivel no cede, es señal
            de absorción real.
          </li>
          <li>
            Entrá <strong>passive</strong> del lado del absorbedor, un tick
            arriba (si es bid wall) o un tick abajo (si es ask wall). No
            cruces.
          </li>
          <li>
            Stop ajustado: si el nivel finalmente cede (size desaparece y
            sigue habiendo agresión), salí inmediatamente. Esto es lo más
            importante de la estrategia.
          </li>
          <li>
            Target: 2–5 ticks. Es scalp, no swing.
          </li>
        </ol>
      </Section>

      <Section title="Cuándo usarla" tone="insight">
        <Checks
          items={[
            "Volumen alto: sin flujo, ‘absorción’ es solo ausencia de operaciones.",
            "Spread normal/ajustado: no funciona en spreads anómalos.",
            "Después de un movimiento direccional fuerte: la absorción suele aparecer en niveles donde un institucional está armando posición contraria.",
            "Cuando podés sizearte chico (1-2 contratos): es trade de probabilidad alta y profit chico, sumalo de a poco.",
          ]}
        />
      </Section>

      <Section title="Cuándo NO usarla" tone="danger">
        <Crosses
          items={[
            "Mercado fino (pocos trades por minuto): no hay suficiente flujo para distinguir absorción de ausencia.",
            "Antes de noticias o eventos: el wall puede desaparecer instantáneamente cuando se publica el dato.",
            "Cerca de límite de ratio AA: cruzar para entrar te castiga el ratio NOR.",
            "Si necesitás trade ganador hoy: la absorción a veces tarda en pagar. No es estrategia para ‘recuperar’.",
          ]}
        />
      </Section>

      <Section title="Cómo leerlo en este screener">
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>DOM L2</strong>: la barra de cada nivel muestra el size
            relativo. Una barra ~2× más grande que los vecinos es candidato
            a wall.
          </li>
          <li>
            <strong>Flash animations</strong> en el DOM: rojo = size bajó
            (le pegaron), verde = size subió (refill). Un nivel con muchos
            flashes pero size estable es absorción clásica.
          </li>
          <li>
            <strong>Imbalance bar</strong>: si está inclinada contra el
            absorbedor pero éste resiste, mejor señal todavía.
          </li>
        </ul>
      </Section>

      <Section title="Errores comunes" tone="warn">
        <Crosses
          items={[
            "Confundir wall con iceberg: un wall estático que se repone con cantidades iguales puede ser un orden iceberg (lo mismo a efectos del trade) o varias órdenes chicas casuales (no es absorción).",
            "No respetar el stop. La diferencia entre scalp ganador y blowout son los stops disciplinados.",
            "Sizear demasiado porque ‘parece seguro’. Las absorciones fallan más seguido de lo que parece.",
            "Operarla en contratos sin volumen real. El DLR/SEP26 a 5 meses no es un buen candidato; el front sí.",
          ]}
        />
      </Section>

      <Callout tone="warn" title="Mentor NOR">
        Esta es la estrategia más <strong>‘gambling friendly’</strong> de
        la biblioteca. Si te empieza a fallar 3 veces seguidas en un día,{" "}
        <em>parala</em>. La microestructura cambia con la liquidez del día
        — lo que funcionó ayer puede no funcionar hoy. Y cualquier trade
        agresivo te afecta el ratio AA: usalo con moderación.
      </Callout>
    </>
  ),
};
