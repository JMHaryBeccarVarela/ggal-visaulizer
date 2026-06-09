import { Callout, Checks, Crosses, Section } from "../layout";
import type { Strategy } from "../types";

export const carryLecap: Strategy = {
  id: "carry-lecap",
  title: "Carry trade DLR vs Lecap",
  category: "carry",
  difficulty: "avanzado",
  norRelevance: "alta",
  oneLiner:
    "Si la TNA implícita del DLR es menor que la TNA de la Lecap del mismo plazo, te pagan por estar largo pesos.",
  shortDescription:
    "Comparás la curva implícita del DLR con la curva Lecap. El spread es la devaluación que el mercado está pricing.",
  content: (
    <>
      <Callout tone="insight" title="La idea en una línea">
        El mercado de futuros DLR y el mercado de Lecaps cotizan dos
        cosas distintas: <strong>devaluación esperada</strong> y{" "}
        <strong>tasa nominal en pesos</strong>. La diferencia entre ambas
        es lo que el mercado piensa de la política cambiaria. Si te ponés
        del lado correcto, hay carry.
      </Callout>

      <Section title="Qué es y por qué importa">
        <p>
          Si una Lecap a 90 días paga TNA 35% y el DLR del mismo plazo tiene
          TNA implícita 25%, el spread es de 10 pp a favor de la Lecap.
          Eso significa que en pesos rendís más con la Lecap que con la
          inversión equivalente en DLR. Para que ambos rindan igual, el
          dólar tendría que devaluar más de lo que el futuro indica.
        </p>
        <p>
          La estrategia "pura": <strong>comprar Lecap + vender DLR</strong>{" "}
          futuro de plazo similar. Se llama "tasa pisada" o "carry": cobrás
          la tasa en pesos y vendés el seguro de devaluación.
        </p>
      </Section>

      <Section title="Cómo se ejecuta">
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            En el <strong>panel Lecap</strong>, cargá el VT al vencimiento
            de las series que querés mirar (1 vez, se guarda). El panel te
            calcula la TNA real.
          </li>
          <li>
            En la <strong>curva implícita</strong>, mirá la línea cyan
            (Lecaps) vs la ámbar (DLR). Donde la cyan está claramente por
            encima, hay oportunidad de carry vendiendo el DLR de ese plazo.
          </li>
          <li>
            Sizing: por cada peso en Lecap que comprás, vendés el
            equivalente nominal en DLR del mismo plazo. La equivalencia
            depende del precio del DLR (multiplicador 1000).
          </li>
          <li>
            Salida: cuando el spread se cierra o llegás al vencimiento de
            la Lecap. Si la Lecap vence antes que el DLR, tenés que rollear
            o cerrar antes el DLR.
          </li>
        </ol>
      </Section>

      <Section title="Cuándo usarla" tone="insight">
        <Checks
          items={[
            "Spread TNA DLR − TNA Lecap claramente negativo (>5 pp), señal de Lecap atractiva.",
            "Confianza moderada en estabilidad cambiaria (sin riesgo de salto discreto inminente).",
            "Tu cartera NOR está balanceada en ratio y querés agregar exposición de tasa con bajo riesgo direccional.",
            "Hay match de plazos: Lecap vence antes o cerca del DLR.",
          ]}
        />
      </Section>

      <Section title="Cuándo NO usarla" tone="danger">
        <Crosses
          items={[
            "Inminencia de evento cambiario: BCRA cambia las reglas, crawling-peg se acelera, FMI revisa programa.",
            "Spread chico (<2 pp): el riesgo de cola no compensa.",
            "VT de la Lecap desconocido o mal cargado: si el VT está mal, toda la TNA está mal.",
            "Margin disponible justo: el ajuste diario del DLR contra tu cuenta puede activar la regla de 50% DD si hay shock.",
          ]}
        />
      </Section>

      <Section title="Cómo leerlo en este screener">
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Header de la curva implícita</strong>: muestra
            "Devaluación implícita promedio: X p.p." — ese número es la
            diferencia DLR − Lecap promedio. Cuanto más negativo, más
            carry potencial vendiendo DLR.
          </li>
          <li>
            <strong>Panel Lecap</strong>: las TNA de cada Lecap salen
            calculadas a partir del VT que cargaste. Doble check con tu
            mentor o con mae.com.ar la primera vez.
          </li>
          <li>
            <strong>Curva implícita</strong>: si las dos líneas se cruzan,
            ese punto es el vencimiento donde el mercado dice "es
            indiferente quedarse en pesos o en dólares".
          </li>
        </ul>
      </Section>

      <Section title="Errores comunes" tone="warn">
        <Crosses
          items={[
            "Pensar que la tasa pisada es ‘free money’: es seguro de devaluación vendido. Si el dólar salta, perdés en ambas patas (Lecap menos atractiva en términos USD + futuro vendido en pérdida).",
            "No considerar el costo del margen del DLR vendido: la Lecap está inmovilizada y el DLR consume garantía adicional.",
            "Rollearlo sin recalcular el spread: la oportunidad puede haberse cerrado.",
            "Sizing como un trade direccional. La tasa pisada parece chica por contrato pero el riesgo de cola es grande.",
          ]}
        />
      </Section>

      <Callout tone="warn" title="Mentor NOR">
        Esta es una estrategia <strong>institucional clásica</strong>. Te
        suma volumen y presencia limpia (Lecap + DLR son 2 productos
        distintos del segmento financiero) pero exige disciplina con el
        riesgo. Empezá pequeño y dale 2-3 semanas para ver cómo se comporta
        el spread antes de aumentar size.
      </Callout>
    </>
  ),
};
