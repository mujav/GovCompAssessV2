import { describe, expect, it } from "vitest";
import { DEMO_PASSWORD, SEED_USERS, canOpen, checkPassword, hashPassword, homeFor, passwordProblem } from "./accounts";

describe("accounts", () => {
  it("seeds one account for each of the four roles", () => {
    for (const role of ["admin", "owner", "control", "viewer"] as const) expect(SEED_USERS.some((u) => u.role === role)).toBe(true);
    expect(new Set(SEED_USERS.map((u) => u.email)).size).toBe(SEED_USERS.length);
  });

  it("checks demo and chosen passwords against salted hashes", async () => {
    const admin = SEED_USERS[0];
    expect(await checkPassword(admin, DEMO_PASSWORD)).toBe(true);
    expect(await checkPassword(admin, "wrong-1")).toBe(false);
    const hash = await hashPassword("rq-1", "Secret123");
    expect(hash).not.toContain("Secret123");
    expect(await checkPassword({ ...admin, id: "u-x", salt: "rq-1", passwordHash: hash }, "Secret123")).toBe(true);
  });

  it("asks for a reasonable password", () => {
    expect(passwordProblem("short1")).toBeTruthy();
    expect(passwordProblem("longpassword")).toBeTruthy();
    expect(passwordProblem("Longpass1")).toBeUndefined();
  });

  it("lands each role on its own home and keeps it to its pages", () => {
    expect(homeFor("owner")).toBe("/workplaces");
    expect(homeFor("control")).toBe("/my-requirements");
    expect(homeFor("viewer")).toBe("/dashboards");
    expect(canOpen("admin", "/studio/frameworks")).toBe(true);
    expect(canOpen("owner", "/studio/frameworks")).toBe(false);
    expect(canOpen("owner", "/workplaces/new")).toBe(false);
    expect(canOpen("owner", "/clients/demo-entity/requirements")).toBe(true);
    expect(canOpen("control", "/clients/demo-entity/requirements/1.1.2-3")).toBe(true);
    expect(canOpen("control", "/clients/demo-entity/requirements")).toBe(false);
    expect(homeFor("admin")).toBe("/admin/workspaces");
    expect(canOpen("control", "/clients/demo-entity/controls/1.1.2")).toBe(true);
    expect(canOpen("control", "/clients/demo-entity/review")).toBe(false);
    expect(canOpen("control", "/messages")).toBe(true);
    expect(canOpen("owner", "/messages")).toBe(true);
    expect(canOpen("viewer", "/messages")).toBe(false);
    expect(canOpen("owner", "/admin/entities")).toBe(false);
    expect(canOpen("viewer", "/clients/demo-entity")).toBe(true);
    expect(canOpen("viewer", "/clients/demo-entity/analytics")).toBe(true);
    expect(canOpen("viewer", "/clients/demo-entity/plan")).toBe(false);
    expect(canOpen("viewer", "/dashboards/demo-entity")).toBe(true);
  });
});
