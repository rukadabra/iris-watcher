import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { nameInSpoken, pickNamedMembers, rewriteMemberMentions, spokenReply } from "./ask"

const leaked = [
  'Mention the member "Sales Dota 2" with the mention I was given. The user wants me to tag them and invite them to play Dota. This is an invitation, so I answer in character with one short line and no tool call.',
  "Casual, one short line, no tool call.",
  "<@Sales Dota 2> come play Dota, I'm ready, don't run away!",
].join("\n\n")

describe("spokenReply", () => {
  it("drops the instruction paragraphs and keeps the chat line", () => {
    assert.equal(spokenReply(leaked), "<@Sales Dota 2> come play Dota, I'm ready, don't run away!")
  })

  it("keeps a normal answer with more than one paragraph", () => {
    const answer = "One.\n\nTwo."
    assert.equal(spokenReply(answer), answer)
  })

  it("drops an answer that leaks the ping token", () => {
    assert.equal(spokenReply("I don't have a ping token for sales in this context, so you need to @ them first."), "")
  })
})

describe("rewriteMemberMentions", () => {
  it("rewrites a name inside a mention to the member id", () => {
    const text = spokenReply(leaked)
    assert.equal(rewriteMemberMentions(text, [{ id: "42", name: "Sales Dota 2" }]), "<@42> come play Dota, I'm ready, don't run away!")
  })

  it("leaves a correct mention alone", () => {
    assert.equal(rewriteMemberMentions("hi <@42>", [{ id: "42", name: "Sales Dota 2" }]), "hi <@42>")
  })
})

describe("nameInSpoken", () => {
  it("finds a display name written in the message", () => {
    assert.equal(nameInSpoken("tag sales dota 2 and invite them to play dota", "Sales Dota 2"), true)
  })

  it("finds the same name written without spaces", () => {
    assert.equal(nameInSpoken("tag salesdota2 please", "Sales Dota 2"), true)
  })

  it("ignores a short one-word name so 'dota' does not match", () => {
    assert.equal(nameInSpoken("tag sales dota 2 and invite them to play dota", "Dota"), false)
  })
})

describe("pickNamedMembers", () => {
  it("finds a member from the name in the text without a Discord mention", () => {
    assert.deepEqual(
      pickNamedMembers({
        spoken: "tag sales dota 2 and invite them to play dota",
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

  it("prefers the Discord mention", () => {
    assert.deepEqual(
      pickNamedMembers({
        spoken: "answer the question",
        mentioned: [{ id: "42", name: "Sales Dota 2" }],
        candidates: [{ id: "42", name: "Sales Dota 2", aliases: ["Sales Dota 2"] }],
        max: 3,
      }),
      [{ id: "42", name: "Sales Dota 2" }],
    )
  })
})
