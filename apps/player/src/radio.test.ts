import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readLockups } from "./radio"

describe("readLockups", () => {
  it("mengambil id dan judul dari lockup YouTube", () => {
    const data = {
      items: [
        {
          lockupViewModel: {
            contentId: "abcdefghijk",
            metadata: { lockupMetadataViewModel: { title: { content: "Lagu Berikutnya" } } },
          },
        },
        {
          lockupViewModel: {
            contentId: "abcdefghijk",
            metadata: { lockupMetadataViewModel: { title: { content: "Duplikat" } } },
          },
        },
      ],
    }
    assert.deepEqual(readLockups(data), [{ id: "abcdefghijk", title: "Lagu Berikutnya" }])
  })
})
