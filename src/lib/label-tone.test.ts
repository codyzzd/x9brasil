import assert from "node:assert/strict";
import test from "node:test";

import { labelTone } from "./label-tone";

test("classifica as tags positivas como verdes", () => {
  for (const label of ["Eficiente", "Impacto alto", "Presente"]) {
    assert.equal(labelTone(label), "positive");
  }
});

test("classifica as tags negativas como vermelhas", () => {
  for (const label of ["Muitas ausências", "Baixo retorno"]) {
    assert.equal(labelTone(label), "negative");
  }
});

test("mantém classificações parciais como amarelas", () => {
  assert.equal(labelTone("Classificação parcial"), "warning");
});
