import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const secret = body.secret;

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  revalidatePath("/", "layout");
  revalidatePath("/candidatos", "layout");
  revalidatePath("/comparar", "layout");
  revalidatePath("/fontes", "layout");
  revalidateTag("ranking", "max");
  revalidateTag("profile", "max");
  revalidateTag("metadata", "max");

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
