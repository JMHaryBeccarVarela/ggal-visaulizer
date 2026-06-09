import { Callout, Checks, Crosses, Mono, Section } from "../layout";
import type { Strategy } from "../types";

export const marketMaking: Strategy = {
  id: "market-making",
  title: "Market making en DLR · passive first",
  category: "market-making",
  difficulty: "intermedio",
  norRelevance: "critica",
  oneLiner:
    "Provee liquidez antes de consumirla. Cada fill pasivo es un agredido que te baja el ratio AA.",
  shortDescription:
    "Cotizá bid y ask alrededor del fair value. Captás spread y mejorás el ratio que A3 mide.",
  content: (
    <>
      <Callout tone="insight" title="La idea en una línea">
        Operás como contraparte del mercado: ponés punta, esperás ser agredido,
        captás el spread. Cada fill pasivo cuenta como{" "}
        <strong>agredido</strong> en tu ratio NOR — el régimen que A3 te
        exige (AA ≤ 1) está literalmente diseñado para que hagas esto.
      </Callout>

      <Section title="Qué es y por qué importa">
        <p>
          Hacer market making es publicar bid y ask al mismo tiempo en un
          mismo contrato, alrededor de tu estimación de valor justo (mid,
          last o un fair theórico de curva). Cuando alguien levanta tu ask
          o pega tu bid, te ejecutaste <strong>pasivamente</strong>: vos
          estabas puesto, ellos cruzaron.
        </p>
        <p>
          Para el programa NOR el ratio AA ≤ 1 significa que por cada
          contrato agresor (cruzaste punta) necesitás al menos uno
          agredido. Sin market making sistemático el ratio empeora rueda
          tras rueda.
        </p>
      </Section>

      <Section title="Cómo se ejecuta" tone="default">
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            Elegí un contrato con volumen y OI razonables. Suele ser el{" "}
            <strong>front 1–3 meses</strong> (en el panel arriba, los DLR
            con más OI).
          </li>
          <li>
            Definí tu fair value. Empezá por el mid actual. Más avanzado:
            interpolar desde la curva implícita usando el spot A3500.
          </li>
          <li>
            Cotizá bid a <Mono>fair − tick × N</Mono> y ask a{" "}
            <Mono>fair + tick × N</Mono>. <Mono>N</Mono> arranca en 1–2 y
            se ajusta según volatilidad.
          </li>
          <li>
            Actualizá cada vez que el mid se mueve más que tu N. Si dejás
            la punta vieja, te selecciona el flujo informado.
          </li>
          <li>
            Manejá inventario: si acumulás 5 long, bajá el mid teórico 1
            tick para venderte más rápido (skew dinámico).
          </li>
        </ol>
      </Section>

      <Section title="Cuándo usarla" tone="insight">
        <Checks
          items={[
            "Mercado en rango: la prob. de ser agredido en ambos lados es similar.",
            "Spread bid-ask amplio (>5 bps): hay edge real por fill.",
            "Imbalance del DOM balanceado (50/50 en la barra inferior).",
            "Lecaps cortas estables: la curva de carry no está moviéndose.",
          ]}
        />
      </Section>

      <Section title="Cuándo NO usarla" tone="danger">
        <Crosses
          items={[
            "Mercado tendencial fuerte: te van a barrer del lado contrario sistemáticamente.",
            "5 minutos antes/después de datos macro (IPC, BCRA, licitación).",
            "Apertura y cierre: spreads erráticos, riesgo de adverse selection alto.",
            "Cuando ya estás del lado equivocado del ratio: si tu AA ya está en 0.95, sumar más agresores te rompe el mes.",
          ]}
        />
      </Section>

      <Section title="Cómo leerlo en este screener">
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>DOM L2</strong>: mirá si tu nivel queda en medio del
            book. Si quedaste 4° o 5° fila, sos cola — probabilidad baja
            de fill.
          </li>
          <li>
            <strong>Imbalance bar</strong>: si se inclina &gt;65% de un
            lado, retirá la punta de ese lado (te van a comer).
          </li>
          <li>
            <strong>Panel NOR</strong>: card "Ratio AA" — apuntá a quedar
            siempre entre 0.5 y 0.8. Por debajo de 0.5 sos demasiado
            pasivo (no estás operando suficiente); arriba de 0.85 estás
            cerca del límite.
          </li>
        </ul>
      </Section>

      <Section title="Errores comunes" tone="warn">
        <Crosses
          items={[
            "Quedar dormido en la cola: pusiste punta y no la actualizaste; el mid se movió 5 ticks y ahora te van a pegar barato.",
            "Doble lado sin manejar inventario: te quedás acumulando posición y te volvés direccional sin querer.",
            "Pelearle al book: si la profundidad cambia mucho contra vos, no insistas — esperá una rueda más limpia.",
            "Operar contratos sin liquidez para ‘sumar contratos parte’: en lugar de mejorar el ratio empeorás el spread y el slippage.",
          ]}
        />
      </Section>

      <Callout tone="warn" title="Mentor NOR">
        Si vas atrasado de volumen mensual, la tentación es agresividad. No
        compenses con agresor — el ratio te castiga. La forma correcta es{" "}
        <strong>aumentar presencia</strong>: estar puesto en más vencimientos
        y más horas, no apretar más en un solo contrato.
      </Callout>
    </>
  ),
};
