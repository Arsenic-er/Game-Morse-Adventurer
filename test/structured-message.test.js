import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStructuredFields,
  tokenizeStructuredMessage,
} from "../src/game/structuredMessage.js";

const SCHEMA = Object.freeze({
  MSG: Object.freeze({ pattern: /^\d{3}$/ }),
  PRI: Object.freeze({ values: Object.freeze(["1", "2", "3"]) }),
});

test("structured fields accept one exact labelled value with harmless procedure words", () => {
  const result = parseStructuredFields("PSE MSG 041 PRI 2 K", SCHEMA);

  assert.equal(result.ok, true);
  assert.deepEqual(result.fields, { MSG: "041", PRI: "2" });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.tokens, ["PSE", "MSG", "041", "PRI", "2", "K"]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.fields), true);
  assert.equal(Object.isFrozen(result.errors), true);
  assert.equal(Object.isFrozen(result.tokens), true);
});

test("structured fields reject duplicate, reordered, unknown, missing, and invalid hard fields", () => {
  for (const input of [
    "MSG 041 MSG 042 PRI 2",
    "PRI 2 MSG 041",
    "MSG 041 EXTRA 7 PRI 2",
    "MSG 041",
    "MSG 41 PRI 2",
    "MSG 041 PRI 9",
  ]) {
    assert.equal(parseStructuredFields(input, SCHEMA).ok, false, input);
  }
});

test("tokenization is uppercase, bounded, and safe for hostile coercion", () => {
  assert.deepEqual(tokenizeStructuredMessage(" msg 041 / pri-2? "), ["MSG", "041", "PRI-2"]);
  assert.equal(tokenizeStructuredMessage("X".repeat(10_000)).join("").length, 256);
  assert.equal(tokenizeStructuredMessage("A ".repeat(500)).length, 64);

  const hostile = Object.create(null);
  Object.defineProperty(hostile, Symbol.toPrimitive, {
    value() {
      throw new Error("must fail closed");
    },
  });
  assert.deepEqual(tokenizeStructuredMessage(hostile), []);
  assert.equal(parseStructuredFields(hostile, SCHEMA).ok, false);
});

test("schema inspection ignores inherited fields and never invokes accessors", () => {
  let getterCalls = 0;
  const schema = Object.create({
    MSG: { pattern: /^\d{3}$/ },
  });
  Object.defineProperty(schema, "PRI", {
    enumerable: true,
    get() {
      getterCalls += 1;
      throw new Error("must not read schema accessors");
    },
  });

  const result = parseStructuredFields("MSG 041 PRI 2", schema);

  assert.equal(result.ok, false);
  assert.equal(getterCalls, 0);
  assert.deepEqual(result.fields, {});
});
