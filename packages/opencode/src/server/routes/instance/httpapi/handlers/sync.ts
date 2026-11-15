import { Workspace } from "@/control-plane/workspace"
import * as InstanceState from "@/effect/instance-state"
import { Session } from "@/session/session"
import { Database } from "@opencode-ai/core/database/database"
import { EventV2 } from "@opencode-ai/core/event"
import { EventV2Bridge } from "@/event-v2-bridge"
import { EventTable } from "@opencode-ai/core/event/sql"
import { asc } from "drizzle-orm"
import { and } from "drizzle-orm"
import { eq } from "drizzle-orm"
import { lte } from "drizzle-orm"
import { not } from "drizzle-orm"
import { or } from "drizzle-orm"
import { Effect, Scope } from "effect"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { HistoryPayload, ReplayPayload, SessionPayload } from "../groups/sync"
import * as Log from "@opencode-ai/core/util/log"
import { WorkspaceRouteContext } from "../middleware/workspace-routing"

const log = Log.create({ service: "server.sync" })

export const syncHandlers = HttpApiBuilder.group(InstanceHttpApi, "sync", (handlers) =>
  Effect.gen(function* () {
    const workspace = yield* Workspace.Service
    const session = yield* Session.Service
    const scope = yield* Scope.Scope
    const events = yield* EventV2Bridge.Service
    const { db } = yield* Database.Service

    const start = Effect.fn("SyncHttpApi.start")(function* () {
      yield* workspace
        .startWorkspaceSyncing((yield* InstanceState.context).project.id)
        .pipe(Effect.ignore, Effect.forkIn(scope))
      return true
    })

    const replay = Effect.fn("SyncHttpApi.replay")(function* (ctx: { payload: typeof ReplayPayload.Type }) {
      const routeCtx = yield* WorkspaceRouteContext
      const to = routeCtx.directory
      let raw: EventV2.SerializedEvent[] = ctx.payload.events.map((event) => ({
        id: EventV2.ID.make(event.id),
        aggregateID: event.aggregateID,
        seq: event.seq,
        type: event.type,
        data: { ...event.data },
      }))
      // warp entre entornos distintos: las rutas del remitente no existen aquí;
      // se reescriben al directorio de esta instancia (ej. /vercel en un sandbox).
      // El payload trae space.directory (destino), así que el directorio de
      // ORIGEN se busca dentro del primer evento que tenga clave "directory"
      // (anidada: session.created → info.directory, etc.)
      const findDir = (v: unknown): string | undefined => {
        if (Array.isArray(v)) {
          for (const x of v) {
            const r = findDir(x)
            if (r) return r
          }
          return undefined
        }
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>
          if (typeof o["directory"] === "string" && o["directory"]) return o["directory"]
          for (const k of Object.keys(o)) {
            const r = findDir(o[k])
            if (r) return r
          }
        }
        return undefined
      }
      const origin = raw.map((e) => findDir(e.data)).find((d): d is string => !!d && d.length > 0 && d !== to)
      if (origin && to && origin !== to) {
        let dumped = JSON.stringify(raw).split(origin).join(to)
        const rel = origin.replace(/^\//, "")
        if (rel !== origin) dumped = dumped.split(rel).join(to.replace(/^\//, ""))
        raw = JSON.parse(dumped)
      }
      const payload: EventV2.SerializedEvent[] = raw
      const source = payload[0].aggregateID
      log.info("sync replay requested", {
        sessionID: source,
        events: payload.length,
        first: payload[0]?.seq,
        last: payload.at(-1)?.seq,
        directory: ctx.payload.directory,
      })
      yield* events.replayAll(payload)
      log.info("sync replay complete", {
        sessionID: source,
        events: payload.length,
        first: payload[0]?.seq,
        last: payload.at(-1)?.seq,
      })
      return { sessionID: source }
    })

    const steal = Effect.fn("SyncHttpApi.steal")(function* (ctx: { payload: typeof SessionPayload.Type }) {
      const workspaceID = yield* InstanceState.workspaceID
      if (!workspaceID) return yield* new HttpApiError.BadRequest({})

      yield* session.setWorkspace({ sessionID: ctx.payload.sessionID, workspaceID })

      log.info("sync session stolen", {
        sessionID: ctx.payload.sessionID,
        workspaceID,
      })

      return { sessionID: ctx.payload.sessionID }
    })

    const history = Effect.fn("SyncHttpApi.history")(function* (ctx: { payload: typeof HistoryPayload.Type }) {
      const exclude = Object.entries(ctx.payload)
      return yield* db
        .select()
        .from(EventTable)
        .where(
          exclude.length > 0
            ? not(or(...exclude.map(([id, seq]) => and(eq(EventTable.aggregate_id, id), lte(EventTable.seq, seq))))!)
            : undefined,
        )
        .orderBy(asc(EventTable.seq))
        .all()
        .pipe(Effect.orDie)
    })

    return handlers.handle("start", start).handle("replay", replay).handle("steal", steal).handle("history", history)
  }),
)
