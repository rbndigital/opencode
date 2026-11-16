import path from "path"
import { Global } from "@opencode-ai/core/global"
import { Flock } from "@opencode-ai/core/util/flock"
import { Filesystem } from "@/util/filesystem"

// Plaintext on purpose: the server needs the raw values to pass them to
// workspace adapters, which is why writes use 0o600 and values are never
// exposed through the HTTP API.
const file = path.join(Global.Path.data, "adapter-settings.json")
const lockKey = `adapter-settings:${file}`

type Store = Record<string, Record<string, string>>

const scopeKey = (projectID: string, type: string) => `${projectID}:${type}`

async function read(): Promise<Store> {
  return Filesystem.readJson<Store>(file).catch(() => ({}))
}

export async function get(projectID: string, type: string): Promise<Record<string, string>> {
  return (await read())[scopeKey(projectID, type)] ?? {}
}

export async function set(projectID: string, type: string, values: Record<string, string>): Promise<void> {
  if (Object.keys(values).length === 0) return
  await Flock.withLock(lockKey, async () => {
    const store = await read()
    const scoped = store[scopeKey(projectID, type)] ?? {}
    store[scopeKey(projectID, type)] = { ...scoped, ...values }
    await Filesystem.writeJson(file, store, 0o600)
  })
}

export async function has(projectID: string, type: string, key: string): Promise<boolean> {
  return key in (await get(projectID, type))
}

export * as AdapterSettings from "./adapter-settings"
