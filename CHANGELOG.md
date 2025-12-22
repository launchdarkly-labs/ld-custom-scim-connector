# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-12-22

### Added

- Initial release of the SCIM Gateway
- SCIM 2.0 User endpoints (Create, Read, Update, Delete, List)
- Role mapping from Alice `roles[]` to LaunchDarkly `customRole`
- Configurable role mappings via YAML configuration
- SQLite database for Alice↔LaunchDarkly user ID correlation
- Bearer token authentication for incoming requests
- LaunchDarkly SCIM API client with OAuth2 client credentials flow
- Automatic token refresh with configurable buffer time
- Support for both OAuth2 client credentials (`LD_CLIENT_ID`/`LD_CLIENT_SECRET`) and static access tokens (`LD_ACCESS_TOKEN`)
- Docker and Docker Compose support
- Health and readiness endpoints
- Structured logging with pino
- Environment configuration via `.env` file (dotenv)

### Security

- Bearer token authentication required for all SCIM endpoints
- Secure token handling for LaunchDarkly API communication
- Automatic retry with token refresh on 401 responses

