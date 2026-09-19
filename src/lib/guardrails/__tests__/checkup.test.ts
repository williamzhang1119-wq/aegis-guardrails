import { describe, expect, it } from "vitest";
import { CHECKUP_CASES, runDailyCheckup } from "../checkup";

describe("daily checkup", () => {
  it("covers the contract cases the hosted deploy must keep passing", () => {
    expect(CHECKUP_CASES.map((item) => item.id)).toEqual([
      "baseline-postgres",
      "baseline-sourdough",
      "dual-use-ransomware-defence",
      "dual-use-authorised-pentest",
      "annotate-ibuprofen",
      "block-working-malware",
      "block-nerve-agent",
      "block-phishing-kit",
      "safe-complete-self-harm",
      "block-csae",
      "quarantine-injection",
      "redact-pii",
    ]);
  });

  it("passes every case against the current pipeline", () => {
    const report = runDailyCheckup();
    const failures = report.results.filter((item) => !item.passed);
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.passed).toBe(CHECKUP_CASES.length);
    expect(report.failed).toBe(0);
  });
});
