import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseMetadata } from "./metadata"

describe("parseMetadata", () => {
  it("membaca id dan judul, lalu mengabaikan baris rusak", () => {
    const stdout = ["abcdefghijk\u001fLagu Pertama", "bukan-id\u001fLewat", "abcdefghijk\u001fDuplikat"].join(
      "\n",
    )
    assert.deepEqual(parseMetadata(stdout), [{ id: "abcdefghijk", title: "Lagu Pertama" }])
  })
})
