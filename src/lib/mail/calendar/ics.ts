// src/lib/mail/calendar/ics.ts

export function generateICS({
  uid,
  start,
  end,
  summary,
  description,
  location,
}: {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location: string;
}): string {
  const format = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const stamp = format(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LinkBridge//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${format(start)}`,
    `DTEND:${format(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}
