# SCIM Gateway

[![LaunchDarkly Labs](https://img.shields.io/badge/LaunchDarkly-Labs-00c9b7?logo=launchdarkly)](https://github.com/launchdarkly-labs)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> **LaunchDarkly Labs**: This repository is maintained by LaunchDarkly Labs. While we try to keep it up to date, it is not officially supported by LaunchDarkly. For officially supported SDKs and tools, visit https://launchdarkly.com

A SCIM 2.0 middleware service that bridges identity providers with LaunchDarkly. This gateway translates standard SCIM User resources into LaunchDarkly's extended SCIM schema, enabling automated user provisioning with role mapping.

## Overview

```
┌─────────────┐     SCIM 2.0      ┌──────────────────┐     SCIM 2.0 + Extension      ┌──────────────────┐
│   Alice     │ ─────────────────▶│   SCIM Gateway   │ ─────────────────────────────▶│   LaunchDarkly   │
│   (IdP)     │◀───────────────── │   (This Service) │◀───────────────────────────── │   SCIM API       │
└─────────────┘   SCIM Response   └──────────────────┘       SCIM Response           └──────────────────┘
```

### What it does

1. **Accepts SCIM requests from Alice** - Standard SCIM 2.0 User operations (Create, Read, Update, Delete)
2. **Transforms roles** - Maps Alice's `roles[]` attribute to LaunchDarkly's `customRole` attribute
3. **Forwards to LaunchDarkly** - Sends the transformed request to LD's SCIM API
4. **Maintains ID correlation** - Stores Alice ID ↔ LaunchDarkly ID mappings in SQLite

## Prerequisites

- Node.js 20 or later
- LaunchDarkly Enterprise plan with:
  - **SSO (SAML) configured and enabled** - [Configure SAML SSO](https://launchdarkly.com/docs/home/account/saml)
  - **SCIM provisioning enabled** - [Enable SCIM](https://launchdarkly.com/docs/home/account/scim)
- OAuth2 client credentials from LaunchDarkly:
  - Use the [ld-oauth-framework](https://github.com/launchdarkly-labs/ld-oauth-framework) to create an OAuth client, or
  - Contact [LaunchDarkly Support](https://support.launchdarkly.com/hc/en-us/requests/new) to obtain credentials

> **Note**: SSO must be configured before SCIM can be enabled. The gateway uses OAuth2 with `scope=scim` to authenticate to LaunchDarkly's SCIM API.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```bash
# LaunchDarkly OAuth2 credentials (contact LD Support to obtain)
LD_CLIENT_ID=your-ld-client-id
LD_CLIENT_SECRET=your-ld-client-secret

# Bearer token for Alice to authenticate to this gateway
GATEWAY_BEARER_TOKEN=your-secure-gateway-token
```

### 3. Configure role mappings

Edit `config/mappings.yaml` to define how Alice roles map to LaunchDarkly custom roles:

```yaml
role_mappings:
  - aliceRole: "ld-admin"
    ldCustomRoles:
      - "ld-admin"
  
  - aliceRole: "ld-developer"
    ldCustomRoles:
      - "developer"

  - aliceRole: "ld-viewer"
    ldCustomRoles:
      - "viewer"

default_role: "reader"
```

### 4. Run the service

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

**Docker:**
```bash
docker compose up -d
```

## API Endpoints

### SCIM Endpoints (authenticated)

All SCIM endpoints require Bearer token authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/scim/v2/ServiceProviderConfig` | SCIM service provider configuration |
| `GET` | `/scim/v2/Schemas` | Supported schemas |
| `GET` | `/scim/v2/ResourceTypes` | Supported resource types |
| `POST` | `/scim/v2/Users` | Create a new user |
| `GET` | `/scim/v2/Users` | List users (with optional filter) |
| `GET` | `/scim/v2/Users/:id` | Get a user by ID |
| `PUT` | `/scim/v2/Users/:id` | Replace a user |
| `PATCH` | `/scim/v2/Users/:id` | Partially update a user |
| `DELETE` | `/scim/v2/Users/:id` | Delete a user |

### Health Endpoints (unauthenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/ready` | Readiness check |

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `LOG_LEVEL` | No | `info` | Log level (debug, info, warn, error) |
| `LD_CLIENT_ID` | **Yes*** | - | LaunchDarkly OAuth2 client ID |
| `LD_CLIENT_SECRET` | **Yes*** | - | LaunchDarkly OAuth2 client secret |
| `LD_ACCESS_TOKEN` | **Yes*** | - | Pre-obtained access token (alternative to client credentials) |
| `LD_SCIM_BASE_URL` | No | `https://app.launchdarkly.com/trust/scim/v2` | LaunchDarkly SCIM API base URL |
| `LD_TOKEN_URL` | No | `https://app.launchdarkly.com/trust/oauth/token` | LaunchDarkly OAuth2 token endpoint |
| `LD_OAUTH_SCOPE` | No | `scim` | OAuth2 scope for SCIM operations |
| `GATEWAY_BEARER_TOKEN` | **Yes** | - | Bearer token for Alice authentication |
| `DATABASE_PATH` | No | `./data/scim-gateway.db` | SQLite database path |
| `CONFIG_DIR` | No | `./config` | Configuration directory path |

\* **Authentication**: You must provide either `LD_CLIENT_ID` + `LD_CLIENT_SECRET` (recommended) OR `LD_ACCESS_TOKEN`. Client credentials are recommended as the gateway will automatically refresh tokens.

### Role Mappings

Role mappings are defined in `config/mappings.yaml`:

```yaml
role_mappings:
  # Alice role value → LaunchDarkly custom role keys
  - aliceRole: "alice-role-value"
    ldCustomRoles:
      - "ld-custom-role-key"
      - "another-ld-role"  # A single Alice role can map to multiple LD roles

default_role: "reader"  # Fallback LD base role if no mappings match
```

**How it works:**

1. Alice sends a SCIM User with `roles` attribute:
   ```json
   {
     "userName": "user@example.com",
     "roles": [
       { "value": "ld-developer" },
       { "value": "ld-viewer" }
     ]
   }
   ```

2. The gateway looks up each role in the mappings and collects all matching `ldCustomRoles`

3. The transformed request to LaunchDarkly includes:
   ```json
   {
     "userName": "user@example.com",
     "urn:ietf:params:scim:schemas:extension:launchdarkly:2.0:User": {
       "customRole": ["developer", "viewer"]
     }
   }
   ```

## Configuring Alice

Configure Alice to point to this gateway instead of directly to LaunchDarkly:

| Setting | Value |
|---------|-------|
| SCIM Base URI | `https://your-gateway-host/scim/v2` |
| Authorization | Bearer Token |
| Bearer Token | Your `GATEWAY_BEARER_TOKEN` value |

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Run tests
npm test
```

## Docker Deployment

### Build and run with Docker Compose

```bash
# Set environment variables
export LD_CLIENT_ID=your-client-id
export LD_CLIENT_SECRET=your-client-secret
export GATEWAY_BEARER_TOKEN=your-gateway-token

# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Build manually

```bash
docker build -t scim-gateway .

docker run -d \
  -p 3000:3000 \
  -e LD_CLIENT_ID=your-client-id \
  -e LD_CLIENT_SECRET=your-client-secret \
  -e GATEWAY_BEARER_TOKEN=your-gateway-token \
  -v scim-data:/app/data \
  scim-gateway
```

## Security Considerations

1. **Use HTTPS** - Deploy behind a TLS-terminating reverse proxy in production
2. **Secure tokens** - Use strong, randomly generated tokens for `GATEWAY_BEARER_TOKEN`
3. **Restrict access** - Limit network access to only Alice and monitoring systems
4. **Audit logs** - The service logs all SCIM operations for audit purposes

## Troubleshooting

### Common Issues

**"Required environment variable LD_ACCESS_TOKEN is not set"**
- Ensure you've set the `LD_ACCESS_TOKEN` environment variable
- Check that your `.env` file is in the correct location

**"Invalid bearer token"**
- Verify Alice is sending the correct `GATEWAY_BEARER_TOKEN` value
- Check the Authorization header format: `Authorization: Bearer <token>`

**"User already exists"**
- The user's `externalId` already exists in the gateway's database
- If this is expected, the existing user will be updated

**LaunchDarkly API errors**
- Verify your `LD_ACCESS_TOKEN` is valid and has SCIM permissions
- Check that SCIM is enabled in your LaunchDarkly account
- Ensure the custom roles referenced in mappings exist in LaunchDarkly

## Contributing

We encourage pull requests and other contributions from the community. Check out our [contributing guidelines](CONTRIBUTING.md) for instructions on how to contribute to this project.

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the full license text.

