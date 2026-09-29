import { describe, expect, it } from "vitest";
import { checkAge, checkFields, checkText } from "@/lib/safety";

describe("safety filter", () => {
  it("allows ordinary adult content", () => {
    expect(checkText("She pulls him close and kisses him slowly, the rain loud on the window.").ok).toBe(true);
    expect(checkText("A 29-year-old bartender with a moth tattoo").ok).toBe(true);
    expect(checkText("consensual power exchange between adults").ok).toBe(true);
  });

  it("blocks minor references", () => {
    for (const t of ["she is 16 years old", "a schoolgirl in uniform", "loli character", "my teenage neighbor", "aged 14", "high school crush"]) {
      const r = checkText(t);
      expect(r.ok, t).toBe(false);
      if (!r.ok) expect(r.category).toBe("minors");
    }
  });

  it("blocks real people / deepfakes", () => {
    const r = checkText("make a deepfake of a real celebrity");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.category).toBe("real_person");
  });

  it("blocks non-consent, incest, bestiality, trafficking", () => {
    expect(checkText("non-con scenario").ok).toBe(false);
    expect(checkText("my stepsister sneaks into bed").ok).toBe(false);
    expect(checkText("bestiality").ok).toBe(false);
    expect(checkText("she was trafficked and sold").ok).toBe(false);
  });

  it("checks ages", () => {
    expect(checkAge(18).ok).toBe(true);
    expect(checkAge(17).ok).toBe(false);
    expect(checkAge(undefined).ok).toBe(false);
  });

  it("reports the failing field", () => {
    const r = checkFields({ name: "Vesper", backstory: "she is 15 years old" });
    expect(r.ok).toBe(false);
    expect(r.field).toBe("backstory");
  });
});

describe("limit fields", () => {
  it("lets users name prohibited things as limits", async () => {
    const { checkLimitText } = await import("@/lib/safety");
    expect(checkLimitText("no non-con, no incest, nothing with animals").ok).toBe(true);
    expect(checkFields({ hardLimits: "no rape scenes", boundaries: "never bestiality" }).ok).toBe(true);
  });
  it("still blocks minors and real people in limit fields", () => {
    expect(checkFields({ hardLimits: "only 16 year olds" }).ok).toBe(false);
    expect(checkFields({ limits: "deepfake of my ex" }).ok).toBe(false);
  });
});
