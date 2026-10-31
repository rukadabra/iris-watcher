import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readLockups } from "./radio"

describe("readLockups", () => {
  it("reads the id and title from a YouTube lockup", () => {
    const data = {
      items: [
        {
          lockupViewModel: {
            contentId: "abcdefghijk",
            metadata: { lockupMetadataViewModel: { title: { content: "Next Song" } } },
          },
        },
        {
          lockupViewModel: {
            contentId: "abcdefghijk",
            metadata: { lockupMetadataViewModel: { title: { content: "Duplicate" } } },
          },
        },
      ],
    }
    assert.deepEqual(readLockups(data), [{ id: "abcdefghijk", title: "Next Song" }])
  })
})
