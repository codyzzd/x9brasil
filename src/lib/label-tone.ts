export type LabelTone = "positive" | "warning" | "negative";

const positiveLabels = new Set([
  "Eficiente",
  "Impacto alto",
  "Presente",
  "Participação alta",
  "Produção alta",
  "Uso de recursos equilibrado",
]);

const negativeLabels = new Set([
  "Muitas ausências",
  "Baixo retorno",
  "Participação abaixo da mediana",
  "Produção abaixo da mediana",
  "Gastos concentrados",
  "Dados incompletos",
]);

export function labelTone(label: string): LabelTone {
  if (positiveLabels.has(label)) {
    return "positive";
  }

  if (negativeLabels.has(label)) {
    return "negative";
  }

  return "warning";
}
