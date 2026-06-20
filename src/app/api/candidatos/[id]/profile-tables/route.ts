import { NextResponse, type NextRequest } from "next/server";
import {
  getDeputy,
  getProfileProposals,
  getProfilePublicVotes,
  getProfileTables,
} from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ProfileProposal = Awaited<ReturnType<typeof getProfileProposals>>[number];
type ProfilePublicVote = Awaited<ReturnType<typeof getProfilePublicVotes>>[number];
type SortDir = "asc" | "desc";

const PROPOSAL_SORT_COLUMNS = new Set([
  "proposicao",
  "tipo",
  "papel",
  "classificacao",
  "status",
  "data",
]);

const VOTE_SORT_COLUMNS = new Set([
  "votacao",
  "voto",
  "classificacao",
  "severidade",
  "impacto",
  "data",
]);

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const periodId = request.nextUrl.searchParams.get("periodo") || "legislature";
  const section = request.nextUrl.searchParams.get("section");
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") || 0));
  const pageSize = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") || 15)));
  const search = (request.nextUrl.searchParams.get("search") || "").trim().toLocaleLowerCase("pt-BR");
  const sort = request.nextUrl.searchParams.get("sort");
  const dir: SortDir = request.nextUrl.searchParams.get("dir") === "desc" ? "desc" : "asc";
  const deputy = await getDeputy(id);

  if (!deputy) {
    return NextResponse.json({ error: "Deputado não encontrado" }, { status: 404 });
  }

  if (section === "proposals") {
    const proposals = await getProfileProposals(deputy.id, periodId);
    const rows = search
      ? proposals.filter((proposal: Awaited<ReturnType<typeof getProfileProposals>>[number]) =>
          [
            proposal.id,
            proposal.type,
            proposal.number,
            proposal.year,
            proposal.summary,
            proposal.status,
            proposal.participationLabel,
            proposal.proposalNatureLabel,
            proposal.publicValue?.categoryLabel ?? "",
          ].some((value) => value.toLocaleLowerCase("pt-BR").includes(search)),
        )
      : proposals;
    return NextResponse.json(paginate(sortProposals(rows, sort, dir), page, pageSize));
  }

  if (section === "votes") {
    const publicVotes = await getProfilePublicVotes(deputy.id, periodId);
    const rows = search
      ? publicVotes.filter((vote: Awaited<ReturnType<typeof getProfilePublicVotes>>[number]) =>
          [
            vote.voteId,
            vote.description,
            vote.summary ?? "",
            vote.reason,
            vote.classification,
            vote.candidateVote,
            vote.severity,
          ].some((value) => value.toLocaleLowerCase("pt-BR").includes(search)),
        )
      : publicVotes;
    return NextResponse.json({
      ...paginate(sortVotes(rows, sort, dir), page, pageSize),
      aggregates: {
        voteDistribution: countVotesByClassification(rows),
      },
    });
  }

  const tables = await getProfileTables(deputy.id, periodId);
  return NextResponse.json(tables);
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const start = page * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

function sortProposals(rows: ProfileProposal[], sort: string | null, dir: SortDir) {
  if (!sort || !PROPOSAL_SORT_COLUMNS.has(sort)) return rows;

  const sorted = [...rows];
  sorted.sort((a, b) => {
    const va = proposalSortValue(a, sort);
    const vb = proposalSortValue(b, sort);
    const result = compareSortValues(va, vb);
    if (result !== 0) return dir === "asc" ? result : -result;

    const dateResult = compareSortValues(b.date, a.date);
    if (dateResult !== 0) return dateResult;
    return compareSortValues(a.id, b.id);
  });
  return sorted;
}

function proposalSortValue(proposal: ProfileProposal, sort: string) {
  switch (sort) {
    case "proposicao":
      return `${proposal.type} ${proposal.number}${proposal.year} ${proposal.summary}`;
    case "tipo":
      return proposal.proposalNatureLabel;
    case "papel":
      return proposal.participationLabel;
    case "classificacao":
      return proposal.publicValue?.points ?? 0;
    case "status":
      return proposal.status;
    case "data":
      return proposal.date;
    default:
      return "";
  }
}

function compareSortValues(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR");
}

function sortVotes(rows: ProfilePublicVote[], sort: string | null, dir: SortDir) {
  if (!sort || !VOTE_SORT_COLUMNS.has(sort)) return rows;

  const sorted = [...rows];
  sorted.sort((a, b) => {
    const va = voteSortValue(a, sort);
    const vb = voteSortValue(b, sort);
    const result = compareSortValues(va, vb);
    if (result !== 0) return dir === "asc" ? result : -result;

    const dateResult = compareSortValues(b.date, a.date);
    if (dateResult !== 0) return dateResult;
    return compareSortValues(a.voteId, b.voteId);
  });
  return sorted;
}

function voteSortValue(vote: ProfilePublicVote, sort: string) {
  switch (sort) {
    case "votacao":
      return `${vote.date} ${vote.description}`;
    case "voto":
      return candidateVoteLabel(vote.candidateVote);
    case "classificacao":
      return publicVoteClassificationLabel(vote.classification);
    case "severidade":
      return severityLabel(vote.severity);
    case "impacto":
      return vote.scorePoints ?? 0;
    case "data":
      return vote.date;
    default:
      return "";
  }
}

function countVotesByClassification(rows: ProfilePublicVote[]) {
  return rows.reduce<Record<string, number>>((acc, vote) => {
    acc[vote.classification] = (acc[vote.classification] ?? 0) + 1;
    return acc;
  }, {});
}

function publicVoteClassificationLabel(value: string) {
  if (value === "unanalyzed") return "não analisado";
  if (value === "analyzed") return "analisado";
  if (value === "positive_public_interest") return "interesse público";
  if (value === "low_relevance") return "baixa relevância";
  if (value === "negative_public_interest") return "contra interesse público";
  if (value === "harmful_or_self_serving") return "auto-benefício";
  return "neutra";
}

function severityLabel(value: string) {
  if (!value) return "-";
  if (value === "critical") return "crítica";
  if (value === "high") return "alta";
  if (value === "medium") return "média";
  return "baixa";
}

function candidateVoteLabel(value: string) {
  if (value === "yes") return "sim";
  if (value === "no") return "não";
  if (value === "absent") return "ausente";
  return "abstenção";
}
