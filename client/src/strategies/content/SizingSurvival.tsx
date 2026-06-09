import { Callout, Checks, Crosses, Mono, Section } from "../layout";
import type { Strategy } from "../types";

export const sizingSurvival: Strategy = {
  id: "sizing-survival",
  title: "Sizing y supervivencia NOR",
  category: "risk",
  difficulty: "intro",
  norRelevance: "critica",
  oneLiner:
    "Perder 50% del fondo = baja automática. Tu objetivo de sizing es que eso sea imposible.",
  shortDescription:
    "Regla de oro: ninguna decisión te puede acercar al umbral de pérdida del 50%. Sizing, stops y reglas duras.",
  content: (
    <>
      <Callout tone="danger" title="La regla que no se negocia">
        Por reglamento del programa, si el saldo de tu cuenta cae por
        debajo del <strong>50% del fondo inicial</strong> (10.000 DLR
        A3500), salís automáticamente. Tu objetivo de sizing es que ningún
        trade individual ni serie corta de trades pueda acercarte a ese
        nivel.
      </Callout>

      <Section title="Qué es y por qué importa">
        <p>
          A diferencia del trading propio, en NOR no podés "esperar a que
          recupere". Si el costo teórico de cerrar tu posición te lleva
          debajo del 50%, A3 te da de baja. Eso transforma el manejo de
          riesgo de "deseable" a <strong>condición de supervivencia</strong>.
        </p>
        <p>
          La estrategia de sizing tiene que ser conservadora{" "}
          <em>asintóticamente</em>: incluso después de una racha mala, el
          nuevo size tiene que asumir que la racha puede continuar.
        </p>
      </Section>

      <Section title="Math básica del fondo">
        <p>
          Con A3500 a $1.400, el fondo inicial es ≈ <Mono>$14.000.000</Mono>.
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>
            Pérdida máxima absoluta:{" "}
            <Mono>$7.000.000</Mono> (50% del fondo).
          </li>
          <li>
            DD diario máximo recomendado: <strong>5% del fondo</strong> ≈{" "}
            <Mono>$700.000</Mono>. Si perdés más en un día, parás.
          </li>
          <li>
            DD semanal máximo: <strong>10% del fondo</strong>. Si lo
            tocás, pausa de la semana siguiente, conversación con mentor.
          </li>
          <li>
            Cada contrato DLR mueve aproximadamente $1.000 por cada peso
            de variación del precio. Un movimiento típico intradiario de 5
            pesos = $5.000 por contrato.
          </li>
        </ul>
      </Section>

      <Section title="Cómo se ejecuta" tone="default">
        <ol className="list-decimal list-inside space-y-1.5">
          <li>
            <strong>Daily VaR</strong>: arrancá con tope de 3–5 contratos
            netos por día. Eso te da swings P&L típicos de ±$50k, que
            todavía no se acerca al límite diario.
          </li>
          <li>
            <strong>Stop por trade</strong>: nunca más de 1% del fondo
            (≈$140k) por idea. Para DLR, eso son ~28 contratos × 5 pesos,
            o 14 contratos × 10 pesos.
          </li>
          <li>
            <strong>Stop por día</strong>: si perdés 3% del fondo en una
            rueda, cerrás y parás. No promediás, no triplicás.
          </li>
          <li>
            <strong>No promedies en pérdida</strong>: doblar la posición
            "porque va a volver" es la causa más común de blowout. Sumá
            solo cuando estás ganando, nunca cuando estás perdiendo.
          </li>
          <li>
            <strong>Una sola tesis por vez</strong>: no abras 4 trades
            distintos. Si tenés 3 ideas, elegí la mejor.
          </li>
        </ol>
      </Section>

      <Section title="Reglas duras (kill switch)" tone="danger">
        <Crosses
          items={[
            "Si DD diario alcanza 5% del fondo → cierre total, parar la rueda.",
            "Si DD semanal alcanza 10% del fondo → revisar con mentor antes de volver a operar.",
            "Si DD acumulado alcanza 25% del fondo → revisión obligatoria de estrategia. NO seguir ‘como si nada’.",
            "Si DD acumulado alcanza 35% del fondo → considerar bajarte voluntariamente. El programa todavía corre, pero el 50% queda peligrosamente cerca.",
            "Nunca dejar overnight sin haber cerrado o cubierto la posición.",
          ]}
        />
      </Section>

      <Section title="Cuándo escalar el sizing" tone="insight">
        <Checks
          items={[
            "Después de 2–3 semanas consistentes (winrate y expectancy positivos, ratio AA <0.9).",
            "Cuando entendés exactamente por qué ganaste — no por una semana suerte.",
            "Después de revisión con mentor.",
            "Subir size 25% por vez, no 100%. Si va bien otras 2 semanas, otro 25%.",
          ]}
        />
      </Section>

      <Section title="Cómo leerlo en este screener">
        <ul className="list-disc list-inside space-y-1">
          <li>
            <strong>Panel NOR · card DD</strong>: monitor diario. Si pasa
            del verde, ya estás incómodo.
          </li>
          <li>
            <strong>P&L realizado</strong>: comparalo con tu límite del día.
            Si te quedan $200k de margen al límite, no abras posición
            nueva.
          </li>
          <li>
            <strong>Card ratio AA</strong>: cuando el ratio empeora suele
            ser porque estás "tratando de recuperar" con agresiones. Ese
            es el síntoma a cortar antes que el DD.
          </li>
        </ul>
      </Section>

      <Section title="Errores comunes" tone="warn">
        <Crosses
          items={[
            "‘Una más para recuperar’ después de una rueda perdedora. Estadísticamente, ese trade tiende a ser el peor.",
            "Cambiar de estrategia cada 2 días buscando ‘la que funcione’. Es ruido, no señal.",
            "Operar cansado, enojado o fuera de tu horario. Las decisiones malas se concentran en esos estados.",
            "Olvidar que el costo teórico de cerrar posiciones abiertas (especialmente opciones) cuenta para el cálculo del 50%.",
            "Confundir agresividad con compromiso. El compromiso con el programa NOR es presencia y consistencia, no tamaño.",
          ]}
        />
      </Section>

      <Callout tone="warn" title="Mentor NOR">
        Si te pasan más de 2 reglas duras en una semana, no es una mala
        racha — es señal estructural. Pará al menos 2 ruedas, hablalo con
        tu mentor del ALyC, revisá qué estrategia te está fallando, y
        recién entonces volvé. Sobrevivir a un mes malo te paga el año
        entero en este programa.
      </Callout>
    </>
  ),
};
