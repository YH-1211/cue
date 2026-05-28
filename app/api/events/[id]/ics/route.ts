import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

// RFC 5545: 改行は CRLF、長行は折りたたみ、特殊文字はエスケープ
function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// 75オクテット (簡易: 75文字) を超えたら折り返し
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (i === 0) {
      parts.push(line.slice(0, 75));
      i = 75;
    } else {
      parts.push(" " + line.slice(i, i + 74));
      i += 74;
    }
  }
  return parts.join("\r\n");
}

function formatDateUtc(iso: string): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  const hh = d.getUTCHours().toString().padStart(2, "0");
  const mi = d.getUTCMinutes().toString().padStart(2, "0");
  const ss = d.getUTCSeconds().toString().padStart(2, "0");
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, title, description, starts_at, ends_at, venue_name, address, official_url, approved"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return new NextResponse("not found", { status: 404 });
  }
  if (!data.approved) {
    return new NextResponse("not available", { status: 403 });
  }

  const startUtc = formatDateUtc(data.starts_at);
  // ends_at がない場合は +2 時間
  const endIso = data.ends_at
    ? data.ends_at
    : new Date(
        new Date(data.starts_at).getTime() + 2 * 60 * 60 * 1000
      ).toISOString();
  const endUtc = formatDateUtc(endIso);
  const dtstamp = formatDateUtc(new Date().toISOString());

  const location = [data.venue_name, data.address]
    .filter(Boolean)
    .join(" / ");
  const description = [data.description ?? "", data.official_url]
    .filter(Boolean)
    .join("\n\n");
  const uid = `${data.id}@cue-taupe-eight.vercel.app`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cue//Cue Events//JP",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    foldLine(`SUMMARY:${escapeIcs(data.title)}`),
    location ? foldLine(`LOCATION:${escapeIcs(location)}`) : "",
    description ? foldLine(`DESCRIPTION:${escapeIcs(description)}`) : "",
    foldLine(`URL:${data.official_url}`),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  const body = lines.join("\r\n") + "\r\n";

  // ASCII にできない文字を含むファイル名は RFC 5987 形式で
  const baseName = data.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
  const encoded = encodeURIComponent(baseName);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="event.ics"; filename*=UTF-8''${encoded}.ics`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
