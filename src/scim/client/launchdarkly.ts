/**
 * LaunchDarkly SCIM API Client
 * 
 * Handles all outbound SCIM requests to LaunchDarkly's SCIM API.
 * Uses OAuth2 Bearer token authentication.
 */

import { logger } from '../../middleware/logging.js';
import {
  LdScimUserCreatePayload,
  LdScimUserResponse,
  LD_SCIM_EXTENSION_SCHEMA,
  LdScimExtension,
} from '../schemas/launchdarkly.js';
import { ScimPatchOperation } from '../schemas/core.js';

export interface LdScimClientConfig {
  baseUrl: string;
  accessToken: string;
}

export interface LdScimListResponse {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: LdScimUserResponse[];
}

/**
 * LaunchDarkly SCIM API Client
 */
export class LaunchDarklyScimClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(config: LdScimClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.accessToken = config.accessToken;
  }

  /**
   * Make an authenticated request to the LD SCIM API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    logger.debug({ method, url }, 'Making request to LaunchDarkly SCIM API');

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/scim+json',
        Accept: 'application/scim+json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle no-content responses (e.g., DELETE)
    if (response.status === 204) {
      return undefined as T;
    }

    const responseBody = await response.text();
    let data: unknown;

    try {
      data = responseBody ? JSON.parse(responseBody) : undefined;
    } catch {
      logger.error({ status: response.status, body: responseBody }, 'Failed to parse LD SCIM response');
      throw new Error(`Failed to parse LaunchDarkly response: ${responseBody}`);
    }

    if (!response.ok) {
      logger.error({ status: response.status, data }, 'LaunchDarkly SCIM API error');
      throw new LdScimError(
        response.status,
        (data as { detail?: string })?.detail || `HTTP ${response.status}`,
        data
      );
    }

    logger.debug({ status: response.status }, 'LaunchDarkly SCIM API response received');
    return data as T;
  }

  /**
   * Create a new user in LaunchDarkly
   */
  async createUser(user: LdScimUserCreatePayload): Promise<LdScimUserResponse> {
    logger.info({ userName: user.userName }, 'Creating user in LaunchDarkly');
    return this.request<LdScimUserResponse>('POST', '/Users', user);
  }

  /**
   * Get a user by ID from LaunchDarkly
   */
  async getUser(userId: string): Promise<LdScimUserResponse> {
    logger.debug({ userId }, 'Getting user from LaunchDarkly');
    return this.request<LdScimUserResponse>('GET', `/Users/${encodeURIComponent(userId)}`);
  }

  /**
   * List users from LaunchDarkly
   */
  async listUsers(filter?: string, startIndex = 1, count = 100): Promise<LdScimListResponse> {
    const params = new URLSearchParams();
    if (filter) params.set('filter', filter);
    params.set('startIndex', startIndex.toString());
    params.set('count', count.toString());

    const query = params.toString();
    return this.request<LdScimListResponse>('GET', `/Users${query ? '?' + query : ''}`);
  }

  /**
   * Find a user by userName (email)
   */
  async findUserByUserName(userName: string): Promise<LdScimUserResponse | null> {
    try {
      const filter = `userName eq "${userName}"`;
      const result = await this.listUsers(filter);
      return result.Resources.length > 0 ? result.Resources[0] : null;
    } catch (error) {
      if (error instanceof LdScimError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update a user in LaunchDarkly using PATCH
   */
  async patchUser(userId: string, operations: ScimPatchOperation[]): Promise<LdScimUserResponse> {
    logger.info({ userId, operationsCount: operations.length }, 'Patching user in LaunchDarkly');

    return this.request<LdScimUserResponse>('PATCH', `/Users/${encodeURIComponent(userId)}`, {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: operations,
    });
  }

  /**
   * Replace a user in LaunchDarkly using PUT
   */
  async replaceUser(userId: string, user: LdScimUserCreatePayload): Promise<LdScimUserResponse> {
    logger.info({ userId, userName: user.userName }, 'Replacing user in LaunchDarkly');
    return this.request<LdScimUserResponse>('PUT', `/Users/${encodeURIComponent(userId)}`, user);
  }

  /**
   * Delete a user from LaunchDarkly
   */
  async deleteUser(userId: string): Promise<void> {
    logger.info({ userId }, 'Deleting user from LaunchDarkly');
    await this.request<void>('DELETE', `/Users/${encodeURIComponent(userId)}`);
  }

  /**
   * Deactivate a user (set active to false)
   */
  async deactivateUser(userId: string): Promise<LdScimUserResponse> {
    return this.patchUser(userId, [
      { op: 'replace', path: 'active', value: false },
    ]);
  }

  /**
   * Update user's custom roles
   */
  async updateUserCustomRoles(userId: string, customRoles: string[]): Promise<LdScimUserResponse> {
    const extension: LdScimExtension = { customRole: customRoles };
    
    return this.patchUser(userId, [
      {
        op: 'replace',
        path: LD_SCIM_EXTENSION_SCHEMA,
        value: extension,
      },
    ]);
  }
}

/**
 * LaunchDarkly SCIM API Error
 */
export class LdScimError extends Error {
  constructor(
    public status: number,
    public detail: string,
    public response?: unknown
  ) {
    super(`LaunchDarkly SCIM Error (${status}): ${detail}`);
    this.name = 'LdScimError';
  }
}

