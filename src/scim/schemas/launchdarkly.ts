/**
 * LaunchDarkly SCIM Extension Schema Types
 * 
 * LaunchDarkly extends the core SCIM schema with custom attributes for role assignment.
 * Documentation: https://launchdarkly.com/docs/home/account/scim
 */

import { ScimCoreUser, ScimMeta, ScimName } from './core.js';

export const LD_SCIM_EXTENSION_SCHEMA = 'urn:ietf:params:scim:schemas:extension:launchdarkly:2.0:User';
export const LD_SCIM_BASE_URL = 'https://app.launchdarkly.com/trust/scim/v2';

/**
 * LaunchDarkly built-in roles
 */
export type LdBuiltInRole = 'reader' | 'writer' | 'admin' | 'no_access';

/**
 * LaunchDarkly SCIM Extension attributes
 * 
 * Note: roleAttributes is NOT currently implemented in LaunchDarkly's SCIM API
 * despite being mentioned in some documentation.
 */
export interface LdScimExtension {
  /**
   * One of the base LaunchDarkly roles: reader, writer, admin, no_access
   * If unspecified, defaults to 'reader'
   */
  role?: LdBuiltInRole;

  /**
   * A list of custom role keys to assign to the member.
   * If a member has any custom roles, they supersede the base role.
   * Case-sensitive, must match custom role keys exactly.
   * 
   * Can also be provided as a comma-separated string in the root-level
   * `customRole` field, but array format is preferred.
   */
  customRole?: string[];
}

/**
 * LaunchDarkly SCIM User - Core User + LD Extension
 */
export interface LdScimUser extends ScimCoreUser {
  schemas: [
    'urn:ietf:params:scim:schemas:core:2.0:User',
    'urn:ietf:params:scim:schemas:extension:launchdarkly:2.0:User'
  ];

  /**
   * LaunchDarkly extension attributes
   */
  [LD_SCIM_EXTENSION_SCHEMA]?: LdScimExtension;
}

/**
 * Minimal user payload for creating a user in LaunchDarkly via SCIM
 * 
 * According to LaunchDarkly's SCIM API:
 * - emails[] is REQUIRED (at least one email must be provided)
 * - userName is optional (defaults to email address if not provided)
 * - Root-level role and customRole fields are also supported (in addition to extension)
 */
export interface LdScimUserCreatePayload {
  schemas: string[];
  /** Required: At least one email is required */
  emails: Array<{
    value: string;
    primary?: boolean;
    type?: string;
  }>;
  /** Optional: Username (defaults to email if not provided) */
  userName?: string;
  name?: ScimName;
  active?: boolean;
  externalId?: string;
  /** Optional: Root-level role (alternative to extension) */
  role?: LdBuiltInRole;
  /** Optional: Root-level customRole as comma-separated string (alternative to extension array) */
  customRole?: string;
  /** Optional: Root-level customRolesArray (preferred over customRole string) */
  customRolesArray?: string[];
  [LD_SCIM_EXTENSION_SCHEMA]?: LdScimExtension;
}

/**
 * User response from LaunchDarkly SCIM API
 */
export interface LdScimUserResponse {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name?: ScimName;
  active?: boolean;
  emails?: Array<{
    value: string;
    primary?: boolean;
    type?: string;
  }>;
  /** Root-level role (may be present in addition to extension) */
  role?: LdBuiltInRole;
  /** Root-level customRole as comma-separated string (may be present) */
  customRole?: string;
  /** Root-level customRolesArray (preferred, may be present) */
  customRolesArray?: string[];
  meta?: ScimMeta;
  [LD_SCIM_EXTENSION_SCHEMA]?: LdScimExtension;
}

