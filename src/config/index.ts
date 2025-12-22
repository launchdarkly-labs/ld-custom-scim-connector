import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Role mapping configuration
 * Maps Alice role values to LaunchDarkly custom role keys
 */
export interface RoleMapping {
  /** The role value from Alice (from the roles[].value field) */
  aliceRole: string;
  /** The LaunchDarkly custom role key(s) to assign */
  ldCustomRoles: string[];
}

/**
 * Mapping configuration loaded from YAML
 */
export interface MappingConfig {
  roleMappings: RoleMapping[];
  /** Default LD base role if no custom role mapping matches */
  defaultRole: 'reader' | 'writer' | 'admin' | 'no_access';
}

/**
 * LaunchDarkly OAuth2 configuration
 */
export interface LdOAuthConfig {
  /** OAuth2 token endpoint URL */
  tokenUrl: string;
  /** OAuth2 client ID */
  clientId: string;
  /** OAuth2 client secret */
  clientSecret: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** Server port */
  port: number;

  /** LaunchDarkly SCIM API base URL */
  ldScimBaseUrl: string;

  /** LaunchDarkly OAuth2 configuration (preferred) */
  ldOAuth?: LdOAuthConfig;

  /** LaunchDarkly OAuth2 access token (alternative to OAuth config) */
  ldAccessToken?: string;

  /** Bearer token for Alice to authenticate to this gateway */
  gatewayBearerToken: string;

  /** Database path (SQLite) */
  databasePath: string;

  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  /** Role mapping configuration */
  mappings: MappingConfig;
}

/**
 * Load mapping configuration from YAML file
 */
function loadMappingConfig(configPath: string): MappingConfig {
  const defaultConfig: MappingConfig = {
    roleMappings: [],
    defaultRole: 'reader',
  };

  if (!fs.existsSync(configPath)) {
    console.warn(`Mapping config not found at ${configPath}, using defaults`);
    return defaultConfig;
  }

  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as Record<string, unknown>;

    return {
      roleMappings: (config.role_mappings as RoleMapping[]) || [],
      defaultRole: (config.default_role as MappingConfig['defaultRole']) || 'reader',
    };
  } catch (error) {
    console.error(`Failed to load mapping config: ${error}`);
    return defaultConfig;
  }
}

/**
 * Get required environment variable or throw
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Load application configuration from environment variables and config files
 */
export function loadConfig(): AppConfig {
  const configDir = process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
  const mappingsPath = path.join(configDir, 'mappings.yaml');

  const ldScimBaseUrl = process.env.LD_SCIM_BASE_URL || 'https://app.launchdarkly.com/trust/scim/v2';
  const ldTokenUrl = process.env.LD_TOKEN_URL || 'https://app.launchdarkly.com/trust/oauth/token';

  // Check for OAuth2 client credentials (preferred)
  const ldClientId = process.env.LD_CLIENT_ID;
  const ldClientSecret = process.env.LD_CLIENT_SECRET;

  // Check for direct access token (alternative)
  const ldAccessToken = process.env.LD_ACCESS_TOKEN;

  // Validate that we have at least one authentication method
  if (!ldClientId && !ldAccessToken) {
    throw new Error(
      'Missing LaunchDarkly credentials. Set either:\n' +
      '  - LD_CLIENT_ID and LD_CLIENT_SECRET (recommended), or\n' +
      '  - LD_ACCESS_TOKEN (for pre-obtained tokens)'
    );
  }

  // Build OAuth config if client credentials are provided
  let ldOAuth: LdOAuthConfig | undefined;
  if (ldClientId && ldClientSecret) {
    ldOAuth = {
      tokenUrl: ldTokenUrl,
      clientId: ldClientId,
      clientSecret: ldClientSecret,
    };
  } else if (ldClientId && !ldClientSecret) {
    throw new Error('LD_CLIENT_ID is set but LD_CLIENT_SECRET is missing');
  }

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    ldScimBaseUrl,
    ldOAuth,
    ldAccessToken,
    gatewayBearerToken: getRequiredEnv('GATEWAY_BEARER_TOKEN'),
    databasePath: process.env.DATABASE_PATH || './data/scim-gateway.db',
    logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) || 'info',
    mappings: loadMappingConfig(mappingsPath),
  };
}

