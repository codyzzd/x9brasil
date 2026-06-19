import {
  AlertTriangle,
  ArrowUpDown,
  Banknote,
  Calculator,
  CheckCircle2,
  CircleHelp,
  Gauge,
  Layers,
  Lightbulb,
  Palette,
  Star,
  ThumbsUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  PUBLIC_VALUE_CATEGORIES,
  PUBLIC_VALUE_DIMENSION_LABELS,
  PUBLIC_VALUE_WEIGHTS,
} from "@/lib/public-value";
import { getClassificationMetadata } from "@/lib/public-value-server";
import { cn } from "@/lib/utils";

const publicValueCategoryGroups = [
  {
    points: 10,
    labels: Object.values(PUBLIC_VALUE_CATEGORIES)
      .filter((cat) => cat.weight === 10)
      .map((cat) => cat.label),
  },
  {
    points: 8,
    labels: Object.values(PUBLIC_VALUE_CATEGORIES)
      .filter((cat) => cat.weight === 8)
      .map((cat) => cat.label),
  },
  {
    points: 6,
    labels: Object.values(PUBLIC_VALUE_CATEGORIES)
      .filter((cat) => cat.weight === 6)
      .map((cat) => cat.label),
  },
  {
    points: 1,
    labels: Object.values(PUBLIC_VALUE_CATEGORIES)
      .filter((cat) => cat.weight === 1)
      .map((cat) => cat.label),
  },
] as const;

export async function MethodologyContent() {
  const publicValueMetadata = await getClassificationMetadata();

  return (
    <>
      <PublicValueSection metadata={publicValueMetadata} />
    </>
  );
}

function QuickFact({
  icon: Icon,
  title,
  text,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="min-h-36 rounded-md bg-muted/45 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.45)] dark:shadow-none">
      <span className="flex size-9 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
        <Icon className="size-4" />
      </span>
      <div className="mt-3 min-w-0">
        <p className="text-base font-semibold leading-snug text-foreground">
          {title}
        </p>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground text-pretty">
          {text}
        </p>
      </div>
    </div>
  );
}

function PercentileCard() {
  return (
    <div className="rounded-lg border bg-card p-4 text-sm leading-6 text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <ArrowUpDown className="size-4" /> Regra comum: transformação em percentis
      </p>
      <p className="mt-1">
        A maior parte das métricas não entra na fórmula como valor bruto.
        Primeiro calculamos a métrica individual e depois convertemos cada uma
        para uma posição de 0 a 100 dentro do grupo comparado — o menor recebe 0,
        o maior recebe 100 e os demais ficam proporcionalmente entre eles.
      </p>
      <p className="mt-2">
        Valores iguais recebem o mesmo percentil médio. Quando há apenas um
        deputado com dado disponível, ele recebe percentil 50. Dados ausentes
        permanecem indisponíveis e nunca são convertidos em zero.
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          <Lightbulb className="inline size-3 align-text-top" /> Ver exemplo
        </summary>
        <div className="mt-2 rounded-lg bg-muted p-3 text-xs leading-5">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Lightbulb className="size-3.5" /> Exemplo com 5 deputados
          </p>
          <p className="mt-1">
            Presenças por mês: 45%, 72%, 68%, 91%, 53%.
          </p>
          <p className="mt-1">
            Ordenando: 45 → 0, 53 → 25, 68 → 50, 72 → 75, 91 → 100.
          </p>
          <p className="mt-1">
            Um deputado com 68% de presenças receberia percentil 50 —
            está exatamente no meio do grupo.
          </p>
        </div>
      </details>
    </div>
  );
}

function PublicValueSection({
  metadata,
}: {
  metadata: { methodologyVersion: string; reviewedAt: string };
}) {
  return (
    <div className="mt-10 space-y-6">
      <div className="rounded-lg border bg-card p-5 shadow-sm sm:p-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(460px,0.82fr)] lg:items-start">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              <Gauge className="size-3.5" /> Índice experimental
            </p>
            <h2 className="mt-5 text-4xl font-bold leading-tight text-balance">
              Valor Público
            </h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground text-pretty">
              Mede produção em vez de só volume de atividade. A
              nota combina proposições, votos, eficiência, participação e
              campanha em uma escala de 0 a 100.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-full">
            <QuickFact
              icon={Gauge}
              title="Nota de 0 a 100"
              text="Quanto maior, melhor dentro do grupo comparado."
            />
            <QuickFact
              icon={Users}
              title="Comparação nacional"
              text="Estado e partido filtram a tela, não mudam a régua."
            />
            <QuickFact
              icon={Layers}
              title="Dados analisados"
              text="A tarja mostra quanto da base pública já recebeu análise."
            />
            <QuickFact
              icon={CircleHelp}
              title="Pendente não vira zero"
              text="O que não foi classificado fica fora do cálculo."
            />
          </div>
        </div>
      </div>

      <PercentileCard />

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Layers className="size-4 text-muted-foreground" /> Dados públicos analisados
          </p>
          <p className="text-xs text-muted-foreground">
            A tarja superior resume a parcela da base pública já analisada.
          </p>
        </div>
        <div className="space-y-3 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Dados públicos analisados</strong>{" "}
            é a parcela de proposições e votações que já recebeu classificação
            no banco. A análise pode vir de regras automáticas simples ou de IA
            aplicada a votações e proposições.
          </p>
          <p>
            Itens pendentes não recebem nota zero; eles simplesmente ficam fora
            das partes do cálculo que dependem de classificação até que sejam
            analisados.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Calculator className="size-4" /> Fórmula do Valor Público
          </p>
          <p className="text-xs text-muted-foreground">
            Resultado arredondado de 0 a 100.
          </p>
        </div>
        <div className="p-4">
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
            score = participação × {PUBLIC_VALUE_WEIGHTS.participation * 100}%
            {"\n"}      + produção × {PUBLIC_VALUE_WEIGHTS.contribution * 100}%
            {"\n"}      + votos × {PUBLIC_VALUE_WEIGHTS.publicVotes * 100}%
            {"\n"}      + eficiência × {PUBLIC_VALUE_WEIGHTS.efficiency * 100}%
            {"\n"}      + campanha × {PUBLIC_VALUE_WEIGHTS.campaignFinance * 100}%
          </pre>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Calculator className="size-4" /> Composição do Valor Público
          </p>
          <p className="text-xs text-muted-foreground">
            Produção temática tem o dobro do peso dos demais componentes.
          </p>
        </div>
        <div className="p-4">
          <CompositionBar
            segments={[
              { label: PUBLIC_VALUE_DIMENSION_LABELS.participation, weight: 0.15, color: "bg-blue-300" },
              { label: PUBLIC_VALUE_DIMENSION_LABELS.contribution, weight: 0.30, color: "bg-blue-700" },
              { label: PUBLIC_VALUE_DIMENSION_LABELS.publicVotes, weight: 0.25, color: "bg-blue-500" },
              { label: PUBLIC_VALUE_DIMENSION_LABELS.efficiency, weight: 0.20, color: "bg-blue-400" },
              { label: PUBLIC_VALUE_DIMENSION_LABELS.campaignFinance, weight: 0.10, color: "bg-blue-200" },
            ]}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Users className="size-4 text-muted-foreground" /> 1. Participação —{" "}
            {PUBLIC_VALUE_WEIGHTS.participation * 100}%
          </p>
        </div>
        <div className="space-y-3 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            Usa o mesmo cálculo do Índice atual: média dos percentis nacionais
            de presenças em sessões e votos nominais por mês em exercício. A
            diferença é que os percentis são calculados nacionalmente (todo o
            parlamento) e não dentro da coorte filtrada.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Star className="size-4 text-muted-foreground" /> 2. Produção —{" "}
            {PUBLIC_VALUE_WEIGHTS.contribution * 100}%
          </p>
        </div>
        <div className="space-y-3 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            Cada proposição do deputado recebe uma classificação temática
            (ex: Saúde, Combate à corrupção, Educação) com peso de 1 a 10
            pontos. Esse peso é multiplicado pelo estágio da proposição:
            25% quando apenas apresentada, 75% quando possui tramitação
            relevante e 100% quando transformada em norma. Somamos os pontos
            de todas as proposições, dividimos pelos meses em exercício e
            convertemos o resultado em percentil nacional. Nesta versão,
            somente a autoria principal é considerada.
          </p>
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              <Lightbulb className="inline size-3 align-text-top" /> Ver exemplo
            </summary>
            <div className="mt-2 rounded-lg bg-muted p-3 text-xs leading-5">
              <p className="font-medium text-foreground">
                Deputado com 3 proposições em 12 meses
              </p>
              <ul className="mt-1 list-disc pl-4 space-y-1">
                <li>
                  PL sobre saúde (10 pts) × 100% (transformada em norma) = 10
                </li>
                <li>
                  PL sobre educação (8 pts) × 75% (com tramitação) = 6
                </li>
                <li>
                  RIC sobre transparência (10 pts) × 25% (apenas apresentada)
                  = 2,5
                </li>
                <li>Total: 10 + 6 + 2,5 = 18,5 pontos</li>
                <li>18,5 ÷ 12 meses = 1,54 pontos/mês</li>
                <li>
                  Se 1,54 pontos/mês está no percentil 82 nacional, a nota de
                  produção é <strong>82</strong>.
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <ThumbsUp className="size-4 text-muted-foreground" /> 3. Votos —{" "}
            {PUBLIC_VALUE_WEIGHTS.publicVotes * 100}%
          </p>
        </div>
        <div className="space-y-3 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            Cada votação nominal é classificada segundo critérios objetivos:
            impacto fiscal, transparência, fiscalização, privilégio político,
            serviço público, alcance social, burocracia e viabilidade. A
            votação recebe um selo de interesse público: positivo, neutro,
            baixa relevância, negativo ou prejudicial. Votações alinhadas ao
            interesse público somam pontos; as prejudiciais subtraem. Casos
            ambíguos ficam neutros ou pendentes. Ausências só penalizam em
            votações de relevância alta ou crítica.
          </p>
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              <Lightbulb className="inline size-3 align-text-top" /> Ver exemplo
            </summary>
            <div className="mt-2 rounded-lg bg-muted p-3 text-xs leading-5">
              <p className="font-medium text-foreground">
                3 votações hipotéticas
              </p>
              <ul className="mt-1 list-disc pl-4 space-y-1">
                <li>
                  PL da transparência salarial: voto &quot;sim&quot; →
                  <br />
                  classificação &quot;positive_public_interest&quot; → +3 pontos
                </li>
                <li>
                  Aumento de verba de gabinete sem justificativa: voto &quot;sim&quot;
                  →
                  <br />
                  classificação &quot;negative_public_interest&quot; → −2 pontos
                </li>
                <li>
                  Nomeação de rua: voto &quot;não&quot; →
                  <br />
                  classificação &quot;low_relevance&quot; → 0 pontos
                </li>
                <li>Pontuação total de votos: +1 ponto</li>
                <li>
                  Esse total vira um percentil nacional. Se for percentil 54,
                  a nota é <strong>54</strong>.
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Zap className="size-4 text-muted-foreground" /> 4. Finanças —{" "}
            {PUBLIC_VALUE_WEIGHTS.efficiency * 100}%
          </p>
        </div>
        <div className="space-y-3 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            Dividimos os pontos de produção pela despesa total da cota
            parlamentar e multiplicamos por R$ 100 mil. O resultado representa
            quantos pontos de produção o deputado gerou para cada R$ 100
            mil gastos. Esse valor vira um percentil nacional. Gastar mais não
            reduz a nota por si só — o que importa é se a produção
            acompanhou o gasto.
          </p>
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              <Lightbulb className="inline size-3 align-text-top" /> Ver exemplo
            </summary>
            <div className="mt-2 rounded-lg bg-muted p-3 text-xs leading-5">
              <p className="font-medium text-foreground">Dois deputados</p>
              <ul className="mt-1 list-disc pl-4 space-y-1">
                <li>
                  Deputado A: 18,5 pontos ÷ R$ 50 mil × R$ 100 mil =
                  <br />
                  37 pontos por R$ 100 mil
                </li>
                <li>
                  Deputado B: 8 pontos ÷ R$ 30 mil × R$ 100 mil =
                  <br />
                  26,7 pontos por R$ 100 mil
                </li>
                <li>
                  Se 37 está no percentil 68 e 26,7 está no percentil 39, a
                  nota de eficiência de A é <strong>68</strong> e a de B é{" "}
                  <strong>39</strong>.
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Banknote className="size-4 text-muted-foreground" /> 5. Campanha —{" "}
            {PUBLIC_VALUE_WEIGHTS.campaignFinance * 100}%
          </p>
        </div>
        <div className="space-y-3 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            Avalia como a campanha eleitoral foi financiada e como os recursos
            foram gastos, com base em indicadores objetivos calculados a partir
            dos dados oficiais. A nota não depende apenas da existência dos
            dados, mas de indicadores derivados deles.
          </p>
          <p className="font-medium text-foreground">Indicadores e pesos:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Custo por voto (35% — menor é melhor)</li>
            <li>Dependência de dinheiro público (25% — menor é melhor)</li>
            <li>Concentração de receitas (15% — menor é melhor)</li>
            <li>Concentração de despesas (15% — menor é melhor)</li>
            <li>Consistência patrimonial (10%)</li>
          </ul>
          <p>
            Dados ausentes não penalizam o score diretamente. A cobertura de
            dados é exibida separadamente como indicador de confiança da
            análise, não como dimensão de pontuação.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-muted-foreground" /> Exemplo completo do Valor Público
          </p>
        </div>
        <div className="p-4">
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
              <Lightbulb className="inline size-3 align-text-top" /> Ver cálculo final com números
            </summary>
            <div className="mt-2 rounded-lg bg-muted p-3 text-xs leading-5">
              <p className="font-medium text-foreground">Notas obtidas</p>
              <ul className="mt-1 list-disc pl-4 space-y-1">
                <li>Participação: 55</li>
                <li>Produção: 82</li>
                <li>Votos: 54</li>
                <li>Eficiência: 68</li>
                <li>Campanha: 72</li>
              </ul>
              <p className="mt-2 font-medium text-foreground">Fórmula</p>
              <p className="mt-1">
                82 × 0,30 + 54 × 0,25 + 68 × 0,20 + 55 × 0,15 + 72 × 0,10
              </p>
              <p className="mt-1">
                = 24,6 + 13,5 + 13,6 + 8,25 + 7,2
              </p>
              <p className="mt-1">= 67,15 → arredondado para</p>
              <p className="mt-1 font-semibold text-foreground">67</p>
            </div>
          </details>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Layers className="size-4 text-muted-foreground" /> Pontos temáticos
          </p>
          <p className="text-xs text-muted-foreground">
            O peso abaixo é multiplicado pelo estágio da proposição.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {publicValueCategoryGroups.map((group) => (
            <div className="rounded-lg border p-4" key={group.points}>
              <p className="font-semibold tabular-nums">
                {group.points} {group.points === 1 ? "ponto" : "pontos"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {group.labels.join(", ")}.
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <Palette className="size-4 text-muted-foreground" /> Escala do Valor Público
          </p>
          <p className="text-xs text-muted-foreground">
            O índice experimental usa cinco faixas de interpretação.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Band
            className="border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
            dot="bg-red-500"
            title="Muito baixo"
            range="0–39"
          />
          <Band
            className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400"
            dot="bg-orange-500"
            title="Baixo"
            range="40–59"
          />
          <Band
            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
            dot="bg-amber-500"
            title="Médio"
            range="60–74"
          />
          <Band
            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
            dot="bg-emerald-500"
            title="Alto"
            range="75–89"
          />
          <Band
            className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400"
            dot="bg-blue-500"
            title="Excelente"
            range="90–100"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-4 text-sm leading-6 text-muted-foreground">
          <p>
            Classificações ambíguas ficam pendentes e não recebem zero. A
            taxonomia está na versão {metadata.methodologyVersion}, revisada
            em{" "}
            {new Intl.DateTimeFormat("pt-BR").format(
              new Date(`${metadata.reviewedAt}T12:00:00`),
            )}
            .
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <div className="p-4">
            <p className="flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="size-4" /> O que o score permite
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Comparar contribuição temática, eficiência e alinhamento de
              votos entre todos os deputados, independentemente de estado ou
              partido.
            </p>
          </div>
        </div>
        <div className="rounded-lg border bg-card">
          <div className="p-4">
            <p className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="size-4" /> O que ele não afirma
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              A classificação temática e de votos depende de revisão manual e
              pode conter erros. Proposições e votações não classificadas
              simplesmente não entram no cálculo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Band({
  className,
  dot,
  title,
  range,
}: {
  className: string;
  dot: string;
  title: string;
  range: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-4 ${className}`}
    >
      <span className={`size-3 rounded-full ${dot}`} aria-hidden="true" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm tabular-nums">{range} pontos</p>
      </div>
    </div>
  );
}

function CompositionBar({
  segments,
}: {
  segments: Array<{ label: string; weight: number; color: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex h-6 overflow-hidden rounded-full">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className={cn(
              seg.color,
              i === 0 && "rounded-l-full",
              i === segments.length - 1 && "rounded-r-full",
            )}
            style={{ width: `${seg.weight * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${seg.color}`} />
            {seg.label} — {seg.weight * 100}%
          </span>
        ))}
      </div>
    </div>
  );
}
