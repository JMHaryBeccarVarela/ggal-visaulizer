import { Callout, Checks, Crosses, Mono, Section } from "../layout";
import type { Strategy } from "../types";

export const calendarSpread: Strategy = {
  id: "calendar-spread",
  title: "Calendar spread DLR",
  category: "spreads",
  difficulty: "intermedio",
  norRelevance: "alta",
  oneLiner:
    "Comprás un vencimiento y vendés otro. Apostás a la pendiente de la curva, no a la dirección del dólar.",
  shortDescription:
    "Tomás posición en la tasa inter-mes sin exposición direccional neta al spot.",
  content: (
    <>
      <Callout tone="insight" title="La idea en una línea">
        Un spread es <strong>tasa contra tasa</strong>, no peso contra
        dólar. Capturás cuando la curva se aplana o empina, con muchísima
        menos exposición direccional. Suma a tu volumen NOR (2 contratos
        parte por spread) sin meterte en agresiones grandes.
      </Callout>

      <Section title="Qué es y por qué importa">
        <p>
          Un calendar spread vainilla en DLR es{" "}
          <strong>comprar el largo y vender el corto</strong> (o
          viceversa). Por ejemplo: comprar <Mono>DLR/SEP26</Mono> y vender{" "}
          <Mono>DLR/JUN26</Mono>. Tu P&L no depende de cuánto sube o baja
          el dólar mayorista, sino de cómo se mueve la <em>diferencia</em>{" "}
          entre los dos precios.
        </p>
        <p>
          Esto significa que un movimiento de 50 pesos en el spot te afecta
          mucho menos que en una posición direccional pura. A cambio,
          dependés de que la curva se reajuste a tu favor.
        </p>
      </Section>

      <Section title="Cómo se ejecuta">
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            En la <strong>matriz de tasas inter-mes</strong> del screener,
            identificá un par cuya tasa esté lejos del promedio (alto =
            curva muy empinada, bajo = muy plana o invertida).
          </li>
          <li>
            Validá en el <strong>arbitrage scanner</strong> que el Δ vs el
            promedio sea significativo (&gt; 3 pp).
          </li>
          <li>
            Andá <strong>passive en las dos puntas</strong>: poné bid en el
            que querés comprar y ask en el que querés vender. Doble fill
            pasivo = doble agredido en NOR.
          </li>
          <li>
            Salida: cuando la tasa inter-mes vuelve al promedio (o por
            convergencia natural al vto del corto).
          </li>
        </ol>
      </Section>

      <Section title="Sub-tipos según la tesis" tone="default">
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Steepening trade</strong>: comprar largo / vender corto
            cuando creés que la curva se va a empinar (más devaluación
            esperada hacia adelante).
          </li>
          <li>
            <strong>Flattening trade</strong>: vender largo / comprar corto
            si esperás que la curva se aplane (anuncio de programa
            anti-inflacionario, ancla cambiaria reforzada).
          </li>
          <li>
            <strong>Convergencia</strong>: dejar correr una distorsión que
            sabés que tiene que cerrar al vencimiento del contrato corto.
          </li>
        </ul>
      </Section>

      <Section title="Cuándo usarla" tone="insight">
        <Checks
          items={[
            "Tenés visión sobre tasas/política monetaria pero no querés tomar direccional pura del dólar.",
            "El spread inter-mes está en un extremo histórico (medilo con el scanner).",
            "Querés sumar volumen con menos riesgo direccional.",
            "Hay un evento pendiente (BCRA, licitación) que va a mover la curva pero no necesariamente el spot.",
          ]}
        />
      </Section>

      <Section title="Cuándo NO usarla" tone="danger">
        <Crosses
          items={[
            "Mercados ilíquidos en uno de los dos vencimientos: el slippage te come el edge.",
            "Spread ya cerca del promedio histórico: el potencial es chico, el riesgo no.",
            "Confundir spread con riesgo cero: el spread también pierde plata si la curva se mueve en contra.",
            "Sizing como si fuera direccional: la posición duele MENOS pero no es gratis. No multipliques el size por 5.",
          ]}
        />
      </Section>

      <Section title="Cómo leerlo en este screener">
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Matriz de tasas inter-mes</strong>: cada celda es un
            spread potencial. Buscá las extremas (rojo o ámbar fuerte).
          </li>
          <li>
            <strong>Arb scanner</strong>: te lista los pares con mayor
            desvío vs promedio. El Δ es lo que vas a capturar si vuelve a
            la media.
          </li>
          <li>
            <strong>Curva implícita</strong>: visualmente identificás
            steepenings/flattenings comparando la pendiente actual con la
            de Lecaps (línea cyan).
          </li>
        </ul>
      </Section>

      <Section title="Errores comunes" tone="warn">
        <Crosses
          items={[
            "Cerrar antes del vencimiento por nerviosismo y perder la convergencia.",
            "Hacer un spread y olvidar que cada pata sigue teniendo riesgo individual hasta que cierre.",
            "No considerar costo de financiamiento del margen requerido por ambas piernas.",
            "Operar spreads con los símbolos de spread (DLR/MAY26/JUN26) sin entender que se ejecutan en bloque y la liquidez es menor — empezá con ambas patas separadas.",
          ]}
        />
      </Section>

      <Callout tone="warn" title="Mentor NOR">
        Los spreads son ideales para meses con presencia baja: te permiten
        operar varios días seguidos en montos chicos sin desbalancear el
        ratio. Cada spread = 2 contratos parte = aporta volumen y mantiene
        la presencia con bajo P&L diario.
      </Callout>
    </>
  ),
};
