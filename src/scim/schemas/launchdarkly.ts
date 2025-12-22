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
   */
  customRole?: string[];

  /**
   * Additional role attributes for scoped/custom role management.
   * Can be provisioned through SCIM but not SAML.
   */
  roleAttributes?: string[];
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
 */
export interface LdScimUserCreatePayload {
  schemas: string[];
  userName: string;
  name?: ScimName;
  active?: boolean;
  externalId?: string;
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
  meta?: ScimMeta;
  [LD_SCIM_EXTENSION_SCHEMA]?: LdScimExtension;
}

