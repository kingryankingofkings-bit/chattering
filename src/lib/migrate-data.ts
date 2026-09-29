/**
 * Lazy, forward-only migrations for the versioned JSON blobs stored in
 * encrypted columns. Schema migrations are handled by Prisma; this handles
 * *content* shape changes between app/model versions so old records keep
 * working after an upgrade. Each upgrader takes version N to N+1.
 */
import { CHARACTER_SHEET_VERSION, emptySheet, type CharacterSheet, type UserPrefs, defaultPrefs } from "./types";

type Upgrader<T> = Record<number, (v: T) => T>;

const sheetUpgraders: Upgrader<CharacterSheet> = {
  // 0 -> 1: pre-versioned sheets had no lorebook/memories arrays.
  0: (s) => ({ ...emptySheet(), ...s, lorebook: s.lorebook ?? [], memories: s.memories ?? [], version: 1 }),
};

export function migrateSheet(raw: Partial<CharacterSheet> | null | undefined): CharacterSheet {
  let sheet = { ...emptySheet(), ...(raw ?? {}) } as CharacterSheet;
  let v = typeof raw?.version === "number" ? raw.version : 0;
  while (v < CHARACTER_SHEET_VERSION) {
    const up = sheetUpgraders[v];
    sheet = up ? up(sheet) : { ...sheet, version: v + 1 };
    v = sheet.version;
  }
  return sheet;
}

export function migratePrefs(raw: Partial<UserPrefs> | null | undefined): UserPrefs {
  return { ...defaultPrefs(), ...(raw ?? {}), version: 1 };
}
