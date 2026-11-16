import { Schema, Struct } from "effect"
import { ProjectV2 } from "@opencode-ai/core/project"
import type { InstanceContext } from "@/project/instance-context"
import { WorkspaceV2 } from "@opencode-ai/core/workspace"
import type { DeepMutable } from "@opencode-ai/core/schema"

export const WorkspaceInfo = Schema.Struct({
  id: WorkspaceV2.ID,
  type: Schema.String,
  name: Schema.String,
  branch: Schema.optional(Schema.NullOr(Schema.String)),
  directory: Schema.optional(Schema.NullOr(Schema.String)),
  extra: Schema.optional(Schema.NullOr(Schema.Unknown)),
  projectID: ProjectV2.ID,
}).annotate({ identifier: "Workspace" })
export type WorkspaceInfo = DeepMutable<Schema.Schema.Type<typeof WorkspaceInfo>>

export const WorkspaceListedInfo = Schema.Struct(Struct.omit(WorkspaceInfo.fields, ["id"])).annotate({
  identifier: "WorkspaceListedInfo",
})
export type WorkspaceListedInfo = DeepMutable<Schema.Schema.Type<typeof WorkspaceListedInfo>>

export const WorkspaceAdapterSetting = Schema.Struct({
  key: Schema.String,
  label: Schema.optional(Schema.String),
  required: Schema.optional(Schema.Boolean),
  secret: Schema.optional(Schema.Boolean),
}).annotate({ identifier: "WorkspaceAdapterSetting" })
export type WorkspaceAdapterSetting = Schema.Schema.Type<typeof WorkspaceAdapterSetting>

export const WorkspaceAdapterEntry = Schema.Struct({
  type: Schema.String,
  name: Schema.String,
  description: Schema.String,
  settings: Schema.Array(WorkspaceAdapterSetting),
  configured: Schema.optional(Schema.Boolean),
})
export type WorkspaceAdapterEntry = Schema.Schema.Type<typeof WorkspaceAdapterEntry>

export type Target =
  | {
      type: "local"
      directory: string
    }
  | {
      type: "remote"
      url: string | URL
      headers?: HeadersInit
    }

export type WorkspaceAdapterContext = {
  readonly instance?: InstanceContext
  readonly workspaceID?: WorkspaceV2.ID
  readonly settings?: Record<string, string>
}

export type WorkspaceAdapter = {
  name: string
  description: string
  settings?: WorkspaceAdapterSetting[]
  configure(info: WorkspaceInfo, context?: WorkspaceAdapterContext): WorkspaceInfo | Promise<WorkspaceInfo>
  create(
    info: WorkspaceInfo,
    env: Record<string, string | undefined>,
    from?: WorkspaceInfo,
    context?: WorkspaceAdapterContext,
  ): Promise<void>
  list?(context?: WorkspaceAdapterContext): WorkspaceListedInfo[] | Promise<WorkspaceListedInfo[]>
  remove(info: WorkspaceInfo, context?: WorkspaceAdapterContext): Promise<void>
  target(info: WorkspaceInfo, context?: WorkspaceAdapterContext): Target | Promise<Target>
}
