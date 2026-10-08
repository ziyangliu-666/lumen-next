import { AdminAccountFailure, type AccountSummary } from './adminAccounts.js';
import type { IdentityDatabase } from './identityDatabase.js';
import { PostgresAccountStore } from './postgresStores.js';

export type AdminAccountChange =
  | { readonly role: 'user' | 'staff' }
  | { readonly suspended: boolean };
export interface StaffAccountChanges {
  changeAccount(
    actorId: string,
    targetId: string,
    change: AdminAccountChange,
  ): Promise<AccountSummary>;
}

/** Lock both identities in UUID order, then recheck the actor before changing the target. */
export async function changeAccount(
  db: IdentityDatabase,
  actorId: string,
  targetId: string,
  change: AdminAccountChange,
): Promise<AccountSummary> {
  actorId = actorId.toLowerCase();
  targetId = targetId.toLowerCase();
  if (actorId === targetId) throw new AdminAccountFailure('self_change');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(actorId)) throw new AdminAccountFailure('actor_forbidden');
  if (!uuid.test(targetId)) throw new AdminAccountFailure('account_not_found');
  return db.withTransaction(async (tx) => {
    const rows = await tx.query<{ id: string; role: string; suspended: boolean; deleted: boolean }>(
      'select id, role, suspended, deleted_at is not null as deleted from accounts where id in ($1, $2) order by id for update',
      [actorId, targetId],
    );
    const actor = rows.find((row) => row.id === actorId);
    if (!actor || actor.role !== 'staff' || actor.suspended || actor.deleted)
      throw new AdminAccountFailure('actor_forbidden');
    const target = rows.find((row) => row.id === targetId);
    if (!target || target.deleted) throw new AdminAccountFailure('account_not_found');
    // Reuse identity's revocation/purge policy on this transaction, without a nested BEGIN.
    const store = new PostgresAccountStore({
      query: (sql, params) => tx.query(sql, params),
      withTransaction: (work) => work(tx),
    });
    if ('role' in change) await store.setRole(targetId, change.role);
    else await store.suspend(targetId, change.suspended);
    const result = await store.getAdminAccount(targetId);
    if (!result) throw new AdminAccountFailure('account_not_found');
    return result;
  });
}
