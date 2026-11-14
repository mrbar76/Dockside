import { cache } from "react";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "../db";
import { clubs } from "../db/schema";

export const getClub = cache(async (slug: string) => {
  const [club] = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
  return club ?? null;
});

export async function requireClub(slug: string) {
  const club = await getClub(slug);
  if (!club) notFound();
  return club;
}

export const listClubs = () => db.select().from(clubs).orderBy(clubs.name);
