"use client"

import { AI_PERSONA_MAX, AI_PROVIDERS, aiProviders, aiTemperature, isAiProvider, type AiProvider } from "@iris/shared/ai"
import { useActionState, useState } from "react"
import { saveAi } from "@/app/dashboard/actions"
import type { PrefixActionState } from "@/lib/types"

const initialState: PrefixActionState = { error: "", saved: false }

export function AiPanel({
  guildId,
  ready,
  saved,
}: {
  guildId: string
  ready: boolean
  saved: {
    provider: string
    model: string
    keyHint: string
    reasoning: boolean
    persona: string
    temperatureTenths: number | null
  } | null
}) {
  const [state, action, pending] = useActionState(saveAi, initialState)
  const start: AiProvider = saved && isAiProvider(saved.provider) ? saved.provider : "gemini"
  const [provider, setProvider] = useState<AiProvider>(start)
  const info = aiProviders[provider]
  const keeps = saved?.provider === provider
  const heat = aiTemperature[provider]
  const savedHeat = keeps && saved.temperatureTenths !== null ? (saved.temperatureTenths / 10).toFixed(1) : ""

  return (
    <section className="block" aria-label="AI">
      <div className="block-head">
        <h3>AI</h3>
        <span className={saved ? "pill live" : "pill idle"}>
          {saved && isAiProvider(saved.provider)
            ? `${aiProviders[saved.provider].label} · ${saved.model}${saved.reasoning ? " · thinking" : ""}`
            : "Off"}
        </span>
      </div>
      <p className="meta">
        Members talk with Iris by tagging her, or with the <code>ask</code> command. This server brings its own API key, so
        usage and cost stay on that key.
      </p>
      {!ready ? (
        <p className="meta">AI keys are not set up on this copy of Iris yet.</p>
      ) : (
        <form action={action} className="welcome-form">
          <input type="hidden" name="guildId" value={guildId} />
          <select
            name="provider"
            aria-label="AI provider"
            value={provider}
            onChange={(event) => isAiProvider(event.target.value) && setProvider(event.target.value)}
          >
            {AI_PROVIDERS.map((id) => (
              <option key={id} value={id}>
                {aiProviders[id].label}
              </option>
            ))}
          </select>
          <input
            key={`model-${provider}`}
            name="model"
            aria-label="Model"
            defaultValue={keeps ? saved.model : ""}
            placeholder={provider === "openrouter" ? `${info.example} (add :nitro for the fastest host)` : info.example}
            maxLength={120}
            spellCheck={false}
            autoComplete="off"
            required
          />
          <input
            key={`key-${provider}`}
            name="key"
            type="password"
            aria-label={`${info.label} API key`}
            placeholder={keeps ? `Saved key ends in ${saved.keyHint}. Leave empty to keep it` : `${info.label} API key`}
            maxLength={400}
            spellCheck={false}
            autoComplete="new-password"
            required={!keeps}
          />
          <textarea
            name="persona"
            aria-label="Personality"
            defaultValue={saved?.persona ?? ""}
            placeholder="Personality, optional. For example: playful and a little sarcastic, loves anime references."
            maxLength={AI_PERSONA_MAX}
            rows={2}
          />
          <div className="temperature-row">
            <input
              key={`temperature-${provider}`}
              name="temperature"
              type="number"
              inputMode="decimal"
              aria-label="Temperature"
              defaultValue={savedHeat}
              placeholder={`Temperature, default ${heat.normal}`}
              min={0}
              max={heat.max}
              step={0.1}
            />
            <p className="meta">
              0 to {heat.max}. Lower is steadier, higher is more varied. Leave it empty for the default. {heat.advice} {heat.caveat}{" "}
              <a href={`/ai#${provider}`} target="_blank" rel="noopener noreferrer">
                Temperature guide
              </a>
            </p>
          </div>
          <label className="check-row">
            <input type="checkbox" name="reasoning" defaultChecked={saved?.reasoning ?? false} />
            <span>
              Let the model think before answering
              <span className="meta"> Better on hard questions, but slower and more expensive. Off answers fastest.</span>
            </span>
          </label>
          <p className="meta">
            Get a key from{" "}
            <a href={info.keyUrl} target="_blank" rel="noopener noreferrer">
              {info.label}
            </a>
            . Iris checks the key and the model before saving, encrypts the key, and never shows it again. Questions are sent to{" "}
            {info.label} with this key, and free tiers may use them to train models.
          </p>
          <div className="prefix-row">
            <button type="submit" name="intent" value="save" disabled={pending}>
              {saved ? "Save" : "Save and turn on"}
            </button>
            {saved ? (
              <button
                type="submit"
                name="intent"
                value="remove"
                className="quiet"
                disabled={pending}
                formNoValidate
                onClick={(event) => {
                  if (!window.confirm("Remove this server's AI key?")) event.preventDefault()
                }}
              >
                Remove key
              </button>
            ) : null}
            {state.error ? <p className="form-error">{state.error}</p> : null}
            {state.saved ? <p className="form-ok">AI settings saved.</p> : null}
          </div>
        </form>
      )}
    </section>
  )
}
