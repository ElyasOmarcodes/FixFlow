import type { Project } from '@/types'
import type { EditorStore, EditorSet, EditorGet } from '../types'

/**
 * The boundary around an assistant turn.
 *
 * A turn is many store writes — add a shape, add two texts, group them, move
 * the group — and a person who does not like the result means "put it back the
 * way it was", not "undo the group, then undo the second text, then…". So the
 * whole turn is recorded as one history entry.
 *
 * The mechanism is the one the resize handles already use, for the same
 * reason: pause history for the duration, then rewind to the starting value
 * *while still paused*, resume, and reapply the final state. That records
 * exactly one step whose "before" is where the turn began. Pausing alone would
 * leave nothing to undo at all.
 */

export interface TemporalControls {
  pause: () => void
  resume: () => void
}

export const createAgentSlice = (
  set: EditorSet,
  get: EditorGet,
  temporal: TemporalControls,
): Pick<EditorStore, 'agentTurnActive' | 'beginAgentTurn' | 'endAgentTurn' | 'rollbackAgentTurn'> => {
  // Held outside the store: it is a rollback buffer, not editor state, and
  // putting a whole second copy of the project into the store would ship it
  // to every subscriber on every turn.
  let snapshot: Project | null = null

  return {
    agentTurnActive: false,

    beginAgentTurn: () => {
      if (snapshot) return   // A turn is already open; never nest them.
      snapshot = get().project
      temporal.pause()
      set({ agentTurnActive: true })
    },

    endAgentTurn: () => {
      const start = snapshot
      snapshot = null
      set({ agentTurnActive: false })
      if (!start) return false
      const finished = get().project
      if (finished === start) { temporal.resume(); return false }
      set({ project: start })
      temporal.resume()
      set({ project: finished })
      return true
    },

    rollbackAgentTurn: () => {
      const start = snapshot
      snapshot = null
      set({ agentTurnActive: false })
      if (!start) return
      set({ project: start, selection: null, selectedLayerIds: [], editingGroupId: null })
      temporal.resume()
    },
  }
}
