/**
 * Role Mapping Transformer
 * 
 * Transforms Alice SCIM User resources to LaunchDarkly SCIM User resources.
 * Maps Alice's roles[] attribute to LaunchDarkly's customRole attribute.
 */

import { MappingConfig } from '../config/index.js';
import { ScimCoreUser, ScimRole, SCIM_CORE_USER_SCHEMA } from '../scim/schemas/core.js';
import {
  LdScimUserCreatePayload,
  LD_SCIM_EXTENSION_SCHEMA,
  LdScimExtension,
} from '../scim/schemas/launchdarkly.js';
import { logger } from '../middleware/logging.js';

/**
 * Transform an Alice SCIM User to a LaunchDarkly SCIM User payload
 */
export function transformAliceUserToLdUser(
  aliceUser: ScimCoreUser,
  config: MappingConfig
): LdScimUserCreatePayload {
  // Extract custom roles from Alice's roles
  const customRoles = deriveCustomRoles(aliceUser.roles || [], config);

  // Build the LD extension
  const ldExtension: LdScimExtension = {};

  if (customRoles.length > 0) {
    ldExtension.customRole = customRoles;
    logger.debug(
      { userName: aliceUser.userName, customRoles },
      'Mapped Alice roles to LD custom roles'
    );
  } else {
    // No custom roles matched, use default base role
    ldExtension.role = config.defaultRole;
    logger.debug(
      { userName: aliceUser.userName, defaultRole: config.defaultRole },
      'No role mappings matched, using default role'
    );
  }

  // Extract email from Alice user - emails is REQUIRED by LaunchDarkly SCIM API
  // Use emails array if provided, otherwise derive from userName
  let emails: Array<{ value: string; primary?: boolean; type?: string }>;
  if (aliceUser.emails && aliceUser.emails.length > 0) {
    emails = aliceUser.emails.map((email) => ({
      value: email.value,
      primary: email.primary,
      type: email.type || 'work',
    }));
  } else if (aliceUser.userName) {
    // Fallback: use userName as email if emails not provided
    emails = [{ value: aliceUser.userName, primary: true, type: 'work' }];
  } else {
    throw new Error('User must have either emails array or userName (which will be used as email)');
  }

  // Build the LD user payload
  const ldUser: LdScimUserCreatePayload = {
    schemas: [
      SCIM_CORE_USER_SCHEMA,
      LD_SCIM_EXTENSION_SCHEMA,
    ],
    emails, // REQUIRED by LaunchDarkly SCIM API
    userName: aliceUser.userName, // Optional, defaults to email if not provided
    active: aliceUser.active ?? true,
    [LD_SCIM_EXTENSION_SCHEMA]: ldExtension,
  };

  // Add optional name if provided
  if (aliceUser.name) {
    ldUser.name = {
      givenName: aliceUser.name.givenName,
      familyName: aliceUser.name.familyName,
    };
  }

  // Preserve externalId if provided (for correlation)
  if (aliceUser.externalId) {
    ldUser.externalId = aliceUser.externalId;
  }

  return ldUser;
}

/**
 * Derive LaunchDarkly custom roles from Alice roles
 */
function deriveCustomRoles(
  aliceRoles: ScimRole[],
  config: MappingConfig
): string[] {
  const customRoles: Set<string> = new Set();

  for (const aliceRole of aliceRoles) {
    const roleValue = aliceRole.value;

    // Find matching mapping
    const mapping = config.roleMappings.find(
      (m) => m.aliceRole === roleValue
    );

    if (mapping) {
      for (const ldRole of mapping.ldCustomRoles) {
        customRoles.add(ldRole);
      }
      logger.debug(
        { aliceRole: roleValue, ldCustomRoles: mapping.ldCustomRoles },
        'Role mapping matched'
      );
    } else {
      logger.debug(
        { aliceRole: roleValue },
        'No mapping found for Alice role'
      );
    }
  }

  return Array.from(customRoles);
}

/**
 * Extract custom roles from an Alice user for comparison
 */
export function extractCustomRolesFromAliceUser(
  aliceUser: ScimCoreUser,
  config: MappingConfig
): string[] {
  return deriveCustomRoles(aliceUser.roles || [], config);
}

/**
 * Determine if role update is needed by comparing current and new roles
 */
export function shouldUpdateRoles(
  currentRoles: string[] | undefined,
  newRoles: string[]
): boolean {
  const current = new Set(currentRoles || []);
  const updated = new Set(newRoles);

  if (current.size !== updated.size) {
    return true;
  }

  for (const role of updated) {
    if (!current.has(role)) {
      return true;
    }
  }

  return false;
}

