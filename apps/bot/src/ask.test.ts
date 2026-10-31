import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { nameInSpoken, pickNamedMembers, rewriteMemberMentions, spokenReply } from "./ask"

const leaked = [
  'Mention the member "Sales Dota 2" with the mention I was given. The user wants me to tag them and invite them to play Dota. This is an invitation, so I answer in character with one short line and no tool call.',
  'Indonesian, casual. Avoid "Kak" and such.',
  "<@Sales Dota 2> ayo main Dota bareng, aku udah siap nih, jangan kabur ya!",
].join("\n\n")

describe("spokenReply", () => {
  it("membuang paragraf instruksi dan menyisakan baris chat", () => {
    assert.equal(spokenReply(leaked), "<@Sales Dota 2> ayo main Dota bareng, aku udah siap nih, jangan kabur ya!")
  })

  it("membiarkan jawaban biasa yang lebih dari satu paragraf", () => {
    const answer = "Satu.\n\nDua."
    assert.equal(spokenReply(answer), answer)
  })

  it("membuang jawaban yang membocorkan ping token", () => {
    assert.equal(spokenReply("I don't have a ping token for sales in this context, so you need to @ them first."), "")
  })
})

describe("rewriteMemberMentions", () => {
  it("mengganti nama di dalam mention dengan id anggota", () => {
    const text = spokenReply(leaked)
    assert.equal(rewriteMemberMentions(text, [{ id: "42", name: "Sales Dota 2" }]), "<@42> ayo main Dota bareng, aku udah siap nih, jangan kabur ya!")
  })

  it("tidak mengubah mention yang sudah benar", () => {
    assert.equal(rewriteMemberMentions("hai <@42>", [{ id: "42", name: "Sales Dota 2" }]), "hai <@42>")
  })
})

describe("nameInSpoken", () => {
  it("mengenali nama tampilan yang ditulis di pesan", () => {
    assert.equal(nameInSpoken("tag sales dota 2, ajakin dia main dota", "Sales Dota 2"), true)
  })

  it("mengenali nama tanpa spasi yang sama", () => {
    assert.equal(nameInSpoken("tag salesdota2 dong", "Sales Dota 2"), true)
  })

  it("mengabaikan nama pendek satu kata supaya 'dota' tidak ikut", () => {
    assert.equal(nameInSpoken("tag sales dota 2, ajakin dia main dota", "Dota"), false)
  })
})

describe("pickNamedMembers", () => {
  it("menemukan anggota dari nama di teks tanpa mention Discord", () => {
    assert.deepEqual(
      pickNamedMembers({
        spoken: "tag sales dota 2, ajakin dia main dota",
        mentioned: [],
        candidates: [
          { id: "42", name: "Sales Dota 2", aliases: ["Sales Dota 2", "salesdota"] },
          { id: "7", name: "Dota", aliases: ["Dota"] },
        ],
        max: 3,
      }),
      [{ id: "42", name: "Sales Dota 2" }],
    )
  })

  it("memakai mention Discord lebih dulu", () => {
    assert.deepEqual(
      pickNamedMembers({
        spoken: "jawab pertanyaannya",
        mentioned: [{ id: "42", name: "Sales Dota 2" }],
        candidates: [{ id: "42", name: "Sales Dota 2", aliases: ["Sales Dota 2"] }],
        max: 3,
      }),
      [{ id: "42", name: "Sales Dota 2" }],
    )
  })
})
