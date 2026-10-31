import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseMetadata } from "./metadata"

describe("parseMetadata", () => {
  it("reads the id and title, then skips broken lines", () => {
    const stdout = ["abcdefghijk\u001fFirst Song", "not-an-id\u001fSkipped", "abcdefghijk\u001fDuplicate"].join(
      "\n",
    )
    assert.deepEqual(parseMetadata(stdout), [{ id: "abcdefghijk", title: "First Song" }])
  })
})
