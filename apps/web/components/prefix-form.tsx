"use client"

import { useActionState } from "react"
import { savePrefix } from "@/app/dashboard/actions"
import type { PrefixActionState } from "@/lib/types"

const initialState: PrefixActionState = { error: "", saved: false }

export function PrefixForm({ guildId, prefix }: { guildId: string; prefix: string }) {
  const [state, action, pending] = useActionState(savePrefix, initialState)

  return (
    <form action={action} className="prefix-form">
      <input type="hidden" name="guildId" value={guildId} />
      <div className="prefix-row">
        <input
          name="prefix"
          aria-label="Prefix"
          defaultValue={prefix}
          maxLength={12}
          spellCheck={false}
          required
        />
        <button type="submit" name="intent" value="save" disabled={pending}>
          Save
        </button>
        <button type="submit" name="intent" value="reset" className="quiet" disabled={pending}>
          Use default
        </button>
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      {state.saved ? <p className="form-ok">Prefix saved. Iris uses it on the next message.</p> : null}
    </form>
  )
}
