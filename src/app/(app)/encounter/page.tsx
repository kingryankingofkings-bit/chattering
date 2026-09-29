import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { decryptJson } from "@/lib/crypto";
import { listSavedEncounters } from "@/lib/encounter";
import { defaultPrefs, type UserPrefs } from "@/lib/types";
import { EncounterView } from "@/components/encounter/encounter-view";

export const metadata: Metadata = { title: "Random Encounter" };

export default async function EncounterPage() {
  const user = await getCurrentUser();
  const prefs = decryptJson<UserPrefs>(user?.prefsEnc, defaultPrefs());
  const saved = user ? await listSavedEncounters(user.id).catch(() => []) : [];
  return (
    <EncounterView
      userPrefs={{ maxIntensity: prefs.maxIntensity, hardLimits: prefs.hardLimits, excludedThemes: prefs.excludedThemes, preferredThemes: prefs.preferredThemes, blurNsfw: prefs.blurNsfw }}
      initialSaved={saved}
    />
  );
}
