import { executionFailure } from "../../execution-failure.js";
import { ProductionStoreTaskState } from "./store-task-state.js";

/** Provider cooldown ledger reads share the canonical Runtime database and outbox identity. */
export abstract class ProductionStoreCooldown extends ProductionStoreTaskState {
  public hasProviderCooldownHistory(): boolean {
    return Boolean(this.database.prepare(
      "select 1 from production_outbox where kind='provider_cooldown' and coalesce(last_error,'')<>'BUSINESS_ADMITTED' limit 1",
    ).get());
  }

  public hasUndeliveredProviderCooldown(): boolean {
    return Boolean(this.database.prepare(`select 1 from production_outbox
      where kind='provider_cooldown' and sent_at is null
        and coalesce(last_error,'')<>'BUSINESS_ADMITTED' limit 1`).get());
  }

  private latestProviderCooldownResponse(): Readonly<Record<string, unknown>> | null {
    const row = this.database.prepare(`select response_json from production_outbox
      where kind='provider_cooldown' and sent_at is not null and response_json is not null
      order by rowid desc limit 1`).get() as
      { response_json: string } | undefined;
    if (!row) return null;
    try { return JSON.parse(row.response_json) as Record<string, unknown>; }
    catch { return null; }
  }

  public latestProviderCooldownServerNow(): string | null {
    const response = this.latestProviderCooldownResponse();
    return typeof response?.server_now === "string" && Number.isFinite(Date.parse(response.server_now))
      ? response.server_now : null;
  }

  public latestProviderCooldownClearance(): "pending_unknown" | "confirmed_absent" | "not_cleared" | null {
    const clearance = this.latestProviderCooldownResponse()?.clearance;
    return clearance === "pending_unknown" || clearance === "confirmed_absent"
      || clearance === "not_cleared" ? clearance : null;
  }

  public pendingProviderCooldownRequestIds(): readonly string[] {
    const rows = this.database.prepare(`select idempotency_key from production_outbox
      where kind='provider_cooldown' and sent_at is null
        and coalesce(last_error,'')<>'BUSINESS_ADMITTED'
        and (json_extract(cast(body_blob as text),'$.phase')='clearance'
          or exists(select 1 from production_outbox clearance
            where clearance.kind='provider_cooldown'
              and json_extract(cast(clearance.body_blob as text),'$.phase')='clearance'
              and json_extract(cast(clearance.body_blob as text),'$.incident_request_id')=
                json_extract(cast(production_outbox.body_blob as text),'$.incident_request_id')))
      order by production_outbox.rowid`).all() as Array<{ idempotency_key: string }>;
    return Object.freeze(rows.map((row) => row.idempotency_key));
  }

  public pendingProviderCooldownIncidentBodies(): readonly Readonly<Record<string, unknown>>[] {
    const rows = this.database.prepare(`select body_blob from production_outbox
      where kind='provider_cooldown'
        and coalesce(last_error,'')<>'BUSINESS_ADMITTED'
        and json_extract(cast(body_blob as text),'$.phase')='incident'
        and not exists(select 1 from production_outbox clearance
          where clearance.kind='provider_cooldown'
            and json_extract(cast(clearance.body_blob as text),'$.phase')='clearance'
            and json_extract(cast(clearance.body_blob as text),'$.clearance')='confirmed_absent'
            and json_extract(cast(clearance.body_blob as text),'$.incident_request_id')=
              json_extract(cast(production_outbox.body_blob as text),'$.incident_request_id'))
      order by created_at,idempotency_key`).all() as Array<{ body_blob: Buffer }>;
    return Object.freeze(rows.map((row) => Object.freeze(
      JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>,
    )));
  }

  public providerCooldownSessionRecoveryIdentity(): Readonly<{
    workerInstanceId: string;
    sessionOpenRequestId: string;
  }> | null {
    const rows = this.database.prepare(`select body_blob from production_outbox notice
      where notice.kind='provider_cooldown'
        and coalesce(notice.last_error,'')<>'BUSINESS_ADMITTED'
        and (notice.sent_at is null
          or (json_extract(cast(notice.body_blob as text),'$.phase')='incident'
            and not exists(select 1 from production_outbox clearance
              where clearance.kind='provider_cooldown' and clearance.sent_at is not null
                and json_extract(cast(clearance.body_blob as text),'$.phase')='clearance'
                and json_extract(cast(clearance.body_blob as text),'$.clearance')='confirmed_absent'
                and json_extract(cast(clearance.body_blob as text),'$.incident_request_id')=
                  json_extract(cast(notice.body_blob as text),'$.incident_request_id'))))
      order by notice.created_at,notice.idempotency_key`).all() as Array<{ body_blob: Buffer }>;
    const bodies = rows.map((row) =>
      JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>);
    if (bodies.length === 0) return null;
    const identities = bodies.map((body) => ({
      workerInstanceId: body.worker_instance_id,
      sessionOpenRequestId: body.session_open_request_id,
    }));
    if (identities.some((identity) => typeof identity.workerInstanceId !== "string"
      || !identity.workerInstanceId || typeof identity.sessionOpenRequestId !== "string"
      || !identity.sessionOpenRequestId)
      || identities.some((identity) => identity.workerInstanceId !== identities[0]!.workerInstanceId
        || identity.sessionOpenRequestId !== identities[0]!.sessionOpenRequestId)) {
      throw executionFailure("failed", "PROVIDER_COOLDOWN_SESSION_RECOVERY_IDENTITY_INVALID");
    }
    return Object.freeze({
      workerInstanceId: identities[0]!.workerInstanceId as string,
      sessionOpenRequestId: identities[0]!.sessionOpenRequestId as string,
    });
  }
}
