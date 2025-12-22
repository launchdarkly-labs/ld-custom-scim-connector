import { getDatabase } from './index.js';

/**
 * User mapping record - correlates Alice user ID with LaunchDarkly user ID
 */
export interface UserMapping {
  id: number;
  aliceId: string;
  aliceExternalId: string | null;
  ldId: string;
  ldUserName: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new user mapping
 */
export function createUserMapping(
  aliceId: string,
  aliceExternalId: string | null,
  ldId: string,
  ldUserName: string
): UserMapping {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO user_mappings (alice_id, alice_external_id, ld_id, ld_user_name)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(aliceId, aliceExternalId, ldId, ldUserName);

  return getUserMappingById(result.lastInsertRowid as number)!;
}

/**
 * Get a user mapping by database ID
 */
export function getUserMappingById(id: number): UserMapping | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, alice_id, alice_external_id, ld_id, ld_user_name, created_at, updated_at
    FROM user_mappings WHERE id = ?
  `);

  const row = stmt.get(id) as Record<string, unknown> | undefined;
  return row ? mapRowToUserMapping(row) : null;
}

/**
 * Get a user mapping by Alice ID (our internal ID assigned to the user)
 */
export function getUserMappingByAliceId(aliceId: string): UserMapping | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, alice_id, alice_external_id, ld_id, ld_user_name, created_at, updated_at
    FROM user_mappings WHERE alice_id = ?
  `);

  const row = stmt.get(aliceId) as Record<string, unknown> | undefined;
  return row ? mapRowToUserMapping(row) : null;
}

/**
 * Get a user mapping by Alice's externalId
 */
export function getUserMappingByExternalId(externalId: string): UserMapping | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, alice_id, alice_external_id, ld_id, ld_user_name, created_at, updated_at
    FROM user_mappings WHERE alice_external_id = ?
  `);

  const row = stmt.get(externalId) as Record<string, unknown> | undefined;
  return row ? mapRowToUserMapping(row) : null;
}

/**
 * Get a user mapping by LaunchDarkly ID
 */
export function getUserMappingByLdId(ldId: string): UserMapping | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, alice_id, alice_external_id, ld_id, ld_user_name, created_at, updated_at
    FROM user_mappings WHERE ld_id = ?
  `);

  const row = stmt.get(ldId) as Record<string, unknown> | undefined;
  return row ? mapRowToUserMapping(row) : null;
}

/**
 * Update a user mapping
 */
export function updateUserMapping(
  aliceId: string,
  updates: Partial<Pick<UserMapping, 'aliceExternalId' | 'ldId' | 'ldUserName'>>
): UserMapping | null {
  const db = getDatabase();

  const setClauses: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (updates.aliceExternalId !== undefined) {
    setClauses.push('alice_external_id = ?');
    values.push(updates.aliceExternalId);
  }
  if (updates.ldId !== undefined) {
    setClauses.push('ld_id = ?');
    values.push(updates.ldId);
  }
  if (updates.ldUserName !== undefined) {
    setClauses.push('ld_user_name = ?');
    values.push(updates.ldUserName);
  }

  values.push(aliceId);

  const stmt = db.prepare(`
    UPDATE user_mappings SET ${setClauses.join(', ')} WHERE alice_id = ?
  `);

  stmt.run(...values);
  return getUserMappingByAliceId(aliceId);
}

/**
 * Delete a user mapping by Alice ID
 */
export function deleteUserMapping(aliceId: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM user_mappings WHERE alice_id = ?');
  const result = stmt.run(aliceId);
  return result.changes > 0;
}

/**
 * Get all user mappings (for listing/debugging)
 */
export function getAllUserMappings(): UserMapping[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, alice_id, alice_external_id, ld_id, ld_user_name, created_at, updated_at
    FROM user_mappings ORDER BY created_at DESC
  `);

  const rows = stmt.all() as Record<string, unknown>[];
  return rows.map(mapRowToUserMapping);
}

/**
 * Map a database row to a UserMapping object
 */
function mapRowToUserMapping(row: Record<string, unknown>): UserMapping {
  return {
    id: row.id as number,
    aliceId: row.alice_id as string,
    aliceExternalId: row.alice_external_id as string | null,
    ldId: row.ld_id as string,
    ldUserName: row.ld_user_name as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

