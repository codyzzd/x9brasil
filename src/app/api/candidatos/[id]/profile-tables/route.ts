import { NextResponse, type NextRequest } from "next/server";
import {
  getDeputy,
  getProfileProposals,
  getProfilePublicVotes,
  getProfilePublicVotesPage,
  getProfileTables,
} from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const periodId = request.nextUrl.searchParams.get("periodo") || "legislature";
  const section = request.nextUrl.searchParams.get("section");
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") || 0));
  const pageSize = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") || 15)));
  const search = (request.nextUrl.searchParams.get("search") || "").trim().toLocaleLowerCase("pt-BR");
  const deputy = await getDeputy(id);

  if (!deputy) {
    return NextResponse.json({ error: "Deputado não encontrado" }, { status: 404 });
  }

  if (section === "proposals") {
    const proposals = await getProfileProposals(deputy.id, periodId);
    const rows = search
      ? proposals.filter((proposal) =>
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
    return NextResponse.json(paginate(rows, page, pageSize));
  }

  if (section === "votes") {
    if (!search) {
      return NextResponse.json(
        await getProfilePublicVotesPage(deputy.id, periodId, page, pageSize),
      );
    }

    const publicVotes = await getProfilePublicVotes(deputy.id, periodId);
    const rows = search
      ? publicVotes.filter((vote) =>
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
    return NextResponse.json(paginate(rows, page, pageSize));
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
