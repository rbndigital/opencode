import { Effect } from "effect"
import { EffectBridge } from "@/effect/bridge"
import { InstanceRef, WorkspaceRef } from "@/effect/instance-ref"
import { getAdapter } from "./adapters"
import { AdapterSettings } from "./adapter-settings"
import type { WorkspaceAdapter, WorkspaceInfo } from "./types"

type AdapterRef = { projectID: WorkspaceInfo["projectID"]; type: string }

const context = (ref?: AdapterRef) =>
  Effect.gen(function* () {
    // AdapterSettings.get never rejects: a broken store degrades to no settings.
    const settings = ref ? yield* Effect.promise(() => AdapterSettings.get(ref.projectID, ref.type)) : undefined
    return {
      instance: yield* InstanceRef,
      workspaceID: yield* WorkspaceRef,
      ...(settings ? { settings } : {}),
    }
  })

export const target = (info: WorkspaceInfo) =>
  Effect.gen(function* () {
    const adapter = getAdapter(info.projectID, info.type)
    const ctx = yield* context({ projectID: info.projectID, type: info.type })
    return yield* EffectBridge.fromPromise(() => adapter.target(info, ctx))
  })

export const configure = (adapter: WorkspaceAdapter, info: WorkspaceInfo) =>
  Effect.gen(function* () {
    const ctx = yield* context({ projectID: info.projectID, type: info.type })
    return yield* EffectBridge.fromPromise(() => adapter.configure(info, ctx))
  })

export const create = (
  adapter: WorkspaceAdapter,
  info: WorkspaceInfo,
  env: Record<string, string | undefined>,
  from?: WorkspaceInfo,
) =>
  Effect.gen(function* () {
    const ctx = yield* context({ projectID: info.projectID, type: info.type })
    return yield* EffectBridge.fromPromise(() => adapter.create(info, env, from, ctx))
  })

export const list = (adapter: WorkspaceAdapter, ref?: AdapterRef) =>
  Effect.gen(function* () {
    const ctx = yield* context(ref)
    return yield* EffectBridge.fromPromise(() => Promise.resolve(adapter.list?.(ctx) ?? []))
  })

export const remove = (info: WorkspaceInfo) =>
  Effect.gen(function* () {
    const adapter = getAdapter(info.projectID, info.type)
    const ctx = yield* context({ projectID: info.projectID, type: info.type })
    return yield* EffectBridge.fromPromise(() => adapter.remove(info, ctx))
  })

export * as WorkspaceAdapterRuntime from "./workspace-adapter-runtime"
