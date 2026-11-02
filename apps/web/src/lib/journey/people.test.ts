import { describe, expect, it } from "vitest";
import { DEMO_DIRECTORY, TEMPLATE_CSV, mergePeople, normalizePerson, parsePeopleRows } from "./people";

const csv = (text: string) => text.split("\n").map((l) => l.match(/("[^"]*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "")));

describe("client people import", () => {
  it("reads the template", () => {
    const r = parsePeopleRows(csv(TEMPLATE_CSV));
    expect(r.skipped).toEqual([]);
    expect(r.people.map((p) => [p.name, p.department, p.access])).toEqual([
      ["Abdullah M.", "Strategy & Performance", "user"],
      ["Hessa B.", "IT Operations", "user"],
      ["Turki Q.", "Human Capital", "contact"],
    ]);
    expect(r.people[0]).toMatchObject({ email: "abdullah@entity.gov.sa", title: "Director of strategy", roles: ["Index owner", "Approver"] });
  });

  it("finds the header below a title row, accepts Arabic headers and skips bad rows with a reason", () => {
    const r = parsePeopleRows([
      ["قائمة الموظفين"],
      ["الاسم", "البريد الإلكتروني", "الإدارة", "المسمى الوظيفي"],
      ["نورة أ.", "noura@entity.gov.sa", "التحول الرقمي", "مديرة"],
      ["", "x@entity.gov.sa", "IT", ""],
      ["Omar", "not-an-email", "IT", ""],
      ["", "", "", ""],
    ]);
    expect(r.people).toHaveLength(1);
    expect(r.people[0]).toMatchObject({ name: "نورة أ.", department: "التحول الرقمي", access: "user" });
    expect(r.skipped).toEqual([
      { row: 4, reason: "No name" },
      { row: 5, reason: '"not-an-email" is not an email address' },
    ]);
  });

  it("explains a sheet without a Name column", () => {
    expect(parsePeopleRows([["Code", "Title"]]).skipped[0].reason).toMatch(/No Name column/);
  });

  it("updates people already on the list instead of duplicating them", () => {
    const list = parsePeopleRows(csv(TEMPLATE_CSV)).people;
    const again = parsePeopleRows([
      ["Name", "Email", "Department"],
      ["Abdullah Mohammed", "ABDULLAH@entity.gov.sa", "Strategy Office"],
      ["Turki Q.", "", ""],
      ["Sara H.", "sara@entity.gov.sa", "Customer Experience"],
    ]).people;
    const m = mergePeople(list, again);
    expect([m.added, m.updated]).toEqual([1, 2]);
    expect(m.list).toHaveLength(4);
    expect(m.list[0]).toMatchObject({ name: "Abdullah M.", department: "Strategy Office", title: "Director of strategy" });
    expect(m.list[2]).toMatchObject({ name: "Turki Q.", department: "Human Capital" });
  });

  it("upgrades stakeholders saved by the older wizard and keeps the demo directory for seeded clients", () => {
    expect(normalizePerson({ av: "AM", name: "Abdullah M.", roles: ["Index owner"], user: true })).toMatchObject({ name: "Abdullah M.", access: "user", department: "", email: "" });
    expect(DEMO_DIRECTORY.find((p) => p.name === "Khalid M.")?.department).toBe("IT Operations");
  });
});
