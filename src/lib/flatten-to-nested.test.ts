import { describe, expect, it } from "vitest";
import { flattenToNested } from "./flatten-to-nested";

describe("flattenToNested", () => {
  it("should handle basic nesting", () => {
    const input = {
      "data[name]": "Matt",
      "data[age]": "30",
    };

    const expected = {
      data: {
        name: "Matt",
        age: "30",
      },
    };

    expect(flattenToNested(input)).toEqual(expected);
  });

  it("should handle deep nesting", () => {
    const input = {
      "data[ship_to_customer][address][line1]": "123 Banana St",
      "data[ship_to_customer][address][locality]": "San Diego",
    };

    const expected = {
      data: {
        ship_to_customer: {
          address: {
            line1: "123 Banana St",
            locality: "San Diego",
          },
        },
      },
    };

    expect(flattenToNested(input)).toEqual(expected);
  });

  it("should handle arrays", () => {
    const input = {
      "data[order_lines][0][sku]": "10-10997-002",
      "data[order_lines][1][sku]": "10-10997-003",
    };

    const expected = {
      data: {
        order_lines: [{ sku: "10-10997-002" }, { sku: "10-10997-003" }],
      },
    };

    expect(flattenToNested(input)).toEqual(expected);
  });

  it("should handle mixed arrays and objects", () => {
    const input = {
      "data[order_lines][0][sku]": "10-10997-002",
      "data[order_lines][0][info][color]": "blue",
    };

    const expected = {
      data: {
        order_lines: [{ sku: "10-10997-002", info: { color: "blue" } }],
      },
    };

    expect(flattenToNested(input)).toEqual(expected);
  });
});
