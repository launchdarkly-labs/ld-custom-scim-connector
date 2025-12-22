/**
 * SCIM 2.0 Core Schema Types
 * Based on RFC 7643: https://www.rfc-editor.org/rfc/rfc7643
 */

export const SCIM_CORE_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_CORE_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';

/**
 * SCIM Meta attribute - contains resource metadata
 */
export interface ScimMeta {
  resourceType: string;
  created?: string;
  lastModified?: string;
  location?: string;
  version?: string;
}

/**
 * SCIM Name complex attribute
 */
export interface ScimName {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

/**
 * SCIM Multi-valued attribute base
 */
export interface ScimMultiValuedAttribute {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

/**
 * SCIM Email attribute
 */
export interface ScimEmail extends ScimMultiValuedAttribute {
  type?: 'work' | 'home' | 'other' | string;
}

/**
 * SCIM Role attribute
 * A list of roles for the user that collectively represent who the user is
 */
export interface ScimRole extends ScimMultiValuedAttribute {
  // No canonical types defined for roles
}

/**
 * SCIM Group membership (read-only on User)
 */
export interface ScimGroupMembership extends ScimMultiValuedAttribute {
  $ref?: string;
  type?: 'direct' | 'indirect';
}

/**
 * SCIM Core User Resource
 * Schema: urn:ietf:params:scim:schemas:core:2.0:User
 */
export interface ScimCoreUser {
  // Required schemas array
  schemas: string[];

  // Common attributes
  id?: string;
  externalId?: string;
  meta?: ScimMeta;

  // Core User attributes
  userName: string;
  name?: ScimName;
  displayName?: string;
  nickName?: string;
  profileUrl?: string;
  title?: string;
  userType?: string;
  preferredLanguage?: string;
  locale?: string;
  timezone?: string;
  active?: boolean;

  // Multi-valued attributes
  emails?: ScimEmail[];
  phoneNumbers?: ScimMultiValuedAttribute[];
  photos?: ScimMultiValuedAttribute[];
  addresses?: ScimAddress[];
  groups?: ScimGroupMembership[];
  entitlements?: ScimMultiValuedAttribute[];
  roles?: ScimRole[];
  x509Certificates?: ScimMultiValuedAttribute[];
}

/**
 * SCIM Address complex attribute
 */
export interface ScimAddress {
  formatted?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: 'work' | 'home' | 'other' | string;
  primary?: boolean;
}

/**
 * SCIM Group member
 */
export interface ScimGroupMember {
  value: string;
  $ref?: string;
  display?: string;
  type?: 'User' | 'Group';
}

/**
 * SCIM Core Group Resource
 * Schema: urn:ietf:params:scim:schemas:core:2.0:Group
 */
export interface ScimCoreGroup {
  schemas: string[];
  id?: string;
  externalId?: string;
  meta?: ScimMeta;
  displayName: string;
  members?: ScimGroupMember[];
}

/**
 * SCIM Error Response
 */
export interface ScimError {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'];
  status: string;
  scimType?: string;
  detail?: string;
}

/**
 * SCIM List Response
 */
export interface ScimListResponse<T> {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'];
  totalResults: number;
  startIndex?: number;
  itemsPerPage?: number;
  Resources: T[];
}

/**
 * SCIM Patch Operation
 */
export interface ScimPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path?: string;
  value?: unknown;
}

/**
 * SCIM Patch Request
 */
export interface ScimPatchRequest {
  schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'];
  Operations: ScimPatchOperation[];
}

/**
 * Create a SCIM error response
 */
export function createScimError(
  status: number,
  detail: string,
  scimType?: string
): ScimError {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: status.toString(),
    detail,
    ...(scimType && { scimType }),
  };
}

