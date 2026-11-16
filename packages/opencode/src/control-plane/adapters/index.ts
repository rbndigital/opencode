import type { ProjectV2 } from "@opencode-ai/core/project"
import type { WorkspaceAdapter, WorkspaceAdapterEntry } from "../types"
import { AdapterSettings } from "../adapter-settings"
import { WorktreeAdapter } from "./worktree"

const BUILTIN: Record<string, WorkspaceAdapter> = {
  worktree: WorktreeAdapter,
}

const state = new Map<ProjectV2.ID, Map<string, WorkspaceAdapter>>()

export function getAdapter(projectID: ProjectV2.ID, type: string): WorkspaceAdapter {
  const custom = state.get(projectID)?.get(type)
  if (custom) return custom

  const builtin = BUILTIN[type]
  if (builtin) return builtin

  throw new Error(`Unknown workspace adapter: ${type}`)
}

export async function listAdapters(projectID: ProjectV2.ID): Promise<WorkspaceAdapterEntry[]> {
  return Promise.all(
    registeredAdapters(projectID).map(async ([type, adapter]) => {
      const settings = adapter.settings ?? []
      const required = settings.filter((setting) => setting.required)
      const present = await Promise.all(required.map((setting) => AdapterSettings.has(projectID, type, setting.key)))
      return {
        type,
        name: adapter.name,
        description: adapter.description,
        settings,
        // An adapter with no required settings counts as configured.
        configured: required.length === 0 || present.every(Boolean),
      }
    }),
  )
}

export function registeredAdapters(projectID: ProjectV2.ID): [string, WorkspaceAdapter][] {
  const adapters = new Map(Object.entries(BUILTIN))
  for (const [type, adapter] of state.get(projectID)?.entries() ?? []) adapters.set(type, adapter)
  return [...adapters.entries()]
}

// Plugins can be loaded per-project so we need to scope them. If you
// want to install a global one pass `ProjectV2.ID.global`
export function registerAdapter(projectID: ProjectV2.ID, type: string, adapter: WorkspaceAdapter) {
  const adapters = state.get(projectID) ?? new Map<string, WorkspaceAdapter>()
  adapters.set(type, adapter)
  state.set(projectID, adapters)
}
