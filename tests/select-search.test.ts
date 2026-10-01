import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesSelectQuery } from "../app/_components/select";

const vehicle = { value: "v1", label: "1234УБА", hint: "Toyota Prius · Болд Бат" };
const customer = { value: "c1", label: "Өлзий Дорж", hint: "9911-2233" };

test("select search: empty query matches everything", () => {
  assert.equal(matchesSelectQuery(vehicle, ""), true);
  assert.equal(matchesSelectQuery(vehicle, "   "), true);
});

test("select search: plate matches in Cyrillic, phonetic Latin and any case/spacing", () => {
  for (const q of ["1234УБА", "1234уба", "1234uba", "1234 UBA", "34уб"]) {
    assert.equal(matchesSelectQuery(vehicle, q), true, q);
  }
  assert.equal(matchesSelectQuery(vehicle, "1235"), false);
});

test("select search: every word must match label or hint", () => {
  assert.equal(matchesSelectQuery(vehicle, "toyota 1234"), true);
  assert.equal(matchesSelectQuery(vehicle, "prius болд"), true);
  assert.equal(matchesSelectQuery(vehicle, "toyota 9999"), false);
});

test("select search: phone ignores dashes and ө/ү are folded", () => {
  assert.equal(matchesSelectQuery(customer, "99112233"), true);
  assert.equal(matchesSelectQuery(customer, "2233"), true);
  assert.equal(matchesSelectQuery(customer, "олзий"), true);
  assert.equal(matchesSelectQuery(customer, "olzii"), true);
});
