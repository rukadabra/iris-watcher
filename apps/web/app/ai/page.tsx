import type { Metadata } from "next"
import { AI_PERSONA_MAX, AI_PROVIDERS, aiProviders, aiTemperature } from "@iris/shared/ai"

export const metadata: Metadata = { title: "AI guide" }

export default function AiGuidePage() {
  return (
    <main className="page prose">
      <h1>AI guide</h1>
      <p>
        These settings shape how Iris chats when someone tags her, replies to her, or uses <code>ask</code>. A manager
        changes them on the dashboard, next to the provider, the model, and the key.
      </p>

      <h2>Temperature</h2>
      <p>
        Temperature controls how varied the wording is. Low values give steady, predictable answers that are good for
        facts, code, and math. High values give more varied and playful answers, and at the top of the range they start
        to wander. Leave it empty to use the model&apos;s own default, which is the right choice for most servers.
      </p>
      <p>
        Many newer models refuse a custom temperature. When a model refuses it, Iris asks again without it and remembers
        that for the model, so the question is still answered with the default. While reasoning is on, Iris does not send
        a temperature at all, because reasoning models do not take one.
      </p>
      <table className="guide-table">
        <thead>
          <tr>
            <th scope="col">Provider</th>
            <th scope="col">Range</th>
            <th scope="col">Default</th>
            <th scope="col">Advice</th>
          </tr>
        </thead>
        <tbody>
          {AI_PROVIDERS.map((id) => {
            const guide = aiTemperature[id]
            return (
              <tr key={id} id={id}>
                <th scope="row">{aiProviders[id].label}</th>
                <td>0 to {guide.max}</td>
                <td>{guide.normal}</td>
                <td>
                  {guide.advice} {guide.caveat}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h2>Reasoning</h2>
      <p>
        With reasoning on, the model thinks before it answers. That helps with hard questions, but answers come slower and
        cost more, because the thinking is billed as output. It is off by default. Some models always reason, and Iris
        then uses the lightest setting that model accepts.
      </p>

      <h2>Personality</h2>
      <p>
        An optional line of at most {AI_PERSONA_MAX} characters, such as &quot;playful and a little sarcastic&quot;. It
        sets who Iris is and how she talks, so she answers questions about herself from it. Iris still answers in the language of the question, keeps answers short, and follows
        her safety rules, which a personality cannot change.
      </p>

      <h2>OpenRouter</h2>
      <p>
        Add <code>:nitro</code> to a model name, such as <code>anthropic/claude-haiku-5.5:nitro</code>, to use the fastest
        host for that model. OpenRouter&apos;s privacy settings decide which hosts may store or train on prompts.
      </p>
    </main>
  )
}
