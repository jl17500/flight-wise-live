import { describe, expect, it } from "vitest";
import { sortRows } from "@/lib/table-sort";

const rows = [
  { id: "NS612", risk: 8.4, note: "storms" },
  { id: "NS214", risk: 6.1, note: "" },
  { id: "NS408", risk: 3.1, note: "crew" },
];

describe("table sorting", () => {
  it("sorts numbers both ways and keeps the original order when unsorted", () => {
    expect(sortRows(rows, { value: (r) => r.risk }, "asc").map((r) => r.id)).toEqual([
      "NS408",
      "NS214",
      "NS612",
    ]);
    expect(sortRows(rows, { value: (r) => r.risk }, "desc").map((r) => r.id)).toEqual([
      "NS612",
      "NS214",
      "NS408",
    ]);
    expect(sortRows(rows, undefined, "asc")).toBe(rows);
  });
  it("sorts flight numbers naturally and keeps empty values last", () => {
    expect(sortRows(rows, { value: (r) => r.id }, "asc").map((r) => r.id)).toEqual([
      "NS214",
      "NS408",
      "NS612",
    ]);
    expect(sortRows(rows, { value: (r) => r.note }, "desc").map((r) => r.id)).toEqual([
      "NS612",
      "NS408",
      "NS214",
    ]);
  });
});
