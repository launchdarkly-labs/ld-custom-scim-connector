/**
 * OAuth2 Token Manager
 * 
 * Handles obtaining and refreshing access tokens from LaunchDarkly
 * using the client credentials flow.
 */

import { logger } from '../middleware/logging.js';

export interface TokenManagerConfig {
  /** LaunchDarkly OAuth2 token endpoint */
  tokenUrl: string;
  /** OAuth2 client ID */
  clientId: string;
  /** OAuth2 client secret */
  clientSecret: string;
  /** OAuth2 scope (defaults to 'scim' for LaunchDarkly SCIM API) */
  scope?: string;
  /** Buffer time before expiry to refresh token (in seconds) */
  refreshBufferSeconds?: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Manages OAuth2 access tokens with automatic refresh
 */
export class TokenManager {
  private config: TokenManagerConfig;
  private accessToken: string | null = null;
  private expiresAt: Date | null = null;
  private refreshBufferMs: number;
  private refreshPromise: Promise<string> | null = null;

  constructor(config: TokenManagerConfig) {
    this.config = config;
    this.refreshBufferMs = (config.refreshBufferSeconds ?? 60) * 1000;
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    // If we have a valid token that's not about to expire, return it
    if (this.accessToken && this.expiresAt && !this.isTokenExpiringSoon()) {
      return this.accessToken;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Start a new refresh
    this.refreshPromise = this.refreshToken();

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Check if the token is expiring soon (within buffer time)
   */
  private isTokenExpiringSoon(): boolean {
    if (!this.expiresAt) {
      return true;
    }
    const now = new Date();
    const bufferTime = new Date(this.expiresAt.getTime() - this.refreshBufferMs);
    return now >= bufferTime;
  }

  /**
   * Refresh the access token using client credentials grant
   */
  private async refreshToken(): Promise<string> {
    const scope = this.config.scope ?? 'scim';
    logger.debug({ scope }, 'Refreshing OAuth2 access token');

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'client_credentials',
          scope,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, error: errorText },
          'Failed to obtain access token'
        );
        throw new Error(`Failed to obtain access token: ${response.status} ${errorText}`);
      }

      const data = (await response.json()) as TokenResponse;

      this.accessToken = data.access_token;

      // Calculate expiry time
      if (data.expires_in) {
        this.expiresAt = new Date(Date.now() + data.expires_in * 1000);
        logger.debug(
          { expiresIn: data.expires_in, expiresAt: this.expiresAt.toISOString() },
          'Access token obtained'
        );
      } else {
        // LaunchDarkly SCIM tokens are valid for 1 year if no expires_in provided
        const oneYearInSeconds = 365 * 24 * 60 * 60;
        this.expiresAt = new Date(Date.now() + oneYearInSeconds * 1000);
        logger.debug('Access token obtained (assuming 1 year expiry for SCIM)');
      }

      return this.accessToken;
    } catch (error) {
      logger.error({ error }, 'Error refreshing access token');
      throw error;
    }
  }

  /**
   * Force a token refresh (useful for handling 401 errors)
   */
  async forceRefresh(): Promise<string> {
    this.accessToken = null;
    this.expiresAt = null;
    return this.getAccessToken();
  }

  /**
   * Check if we have a valid token
   */
  hasValidToken(): boolean {
    return this.accessToken !== null && !this.isTokenExpiringSoon();
  }
}

