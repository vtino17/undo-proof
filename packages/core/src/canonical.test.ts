import { describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "./canonical.js";

describe("portable canonical hashing", () => {
  it("matches the standard SHA-256 known vector", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("sorts object keys without reordering arrays", () => {
    expect(canonicalJson({ z: 1, a: [2, { y: 3, b: 4 }] })).toBe(
      '{"a":[2,{"b":4,"y":3}],"z":1}',
    );
  });
});
