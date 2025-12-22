/**
 * SCIM Server Routes
 * 
 * Defines all SCIM 2.0 endpoints that Alice will call.
 */

import { Router, Request, Response } from 'express';
import { AppConfig } from '../../config/index.js';
import { LaunchDarklyScimClient } from '../client/launchdarkly.js';
import { createUsersController } from './users.controller.js';
import { SCIM_CORE_USER_SCHEMA } from '../schemas/core.js';

/**
 * Create SCIM router with all endpoints
 */
export function createScimRouter(config: AppConfig, ldClient: LaunchDarklyScimClient): Router {
  const router = Router();
  const usersController = createUsersController(config, ldClient);

  // SCIM Discovery Endpoints
  router.get('/ServiceProviderConfig', getServiceProviderConfig);
  router.get('/Schemas', getSchemas);
  router.get('/ResourceTypes', getResourceTypes);

  // Users endpoints
  router.post('/Users', (req, res) => usersController.createUser(req, res));
  router.get('/Users', (req, res) => usersController.listUsers(req, res));
  router.get('/Users/:id', (req, res) => usersController.getUser(req, res));
  router.put('/Users/:id', (req, res) => usersController.replaceUser(req, res));
  router.patch('/Users/:id', (req, res) => usersController.patchUser(req, res));
  router.delete('/Users/:id', (req, res) => usersController.deleteUser(req, res));

  return router;
}

/**
 * GET /scim/v2/ServiceProviderConfig
 * Returns the SCIM Service Provider Configuration
 */
function getServiceProviderConfig(_req: Request, res: Response): void {
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://github.com/launchdarkly/scim-gateway',
    patch: {
      supported: true,
    },
    bulk: {
      supported: false,
      maxOperations: 0,
      maxPayloadSize: 0,
    },
    filter: {
      supported: true,
      maxResults: 100,
    },
    changePassword: {
      supported: false,
    },
    sort: {
      supported: false,
    },
    etag: {
      supported: false,
    },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using the OAuth Bearer Token Standard',
        specUri: 'https://www.rfc-editor.org/info/rfc6750',
        primary: true,
      },
    ],
  });
}

/**
 * GET /scim/v2/Schemas
 * Returns the supported schemas
 */
function getSchemas(_req: Request, res: Response): void {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 1,
    Resources: [
      {
        id: SCIM_CORE_USER_SCHEMA,
        name: 'User',
        description: 'User Account',
        attributes: [
          {
            name: 'userName',
            type: 'string',
            multiValued: false,
            required: true,
            caseExact: false,
            mutability: 'readWrite',
            returned: 'default',
            uniqueness: 'server',
          },
          {
            name: 'name',
            type: 'complex',
            multiValued: false,
            required: false,
            mutability: 'readWrite',
            returned: 'default',
            subAttributes: [
              {
                name: 'givenName',
                type: 'string',
                multiValued: false,
                required: false,
                mutability: 'readWrite',
                returned: 'default',
              },
              {
                name: 'familyName',
                type: 'string',
                multiValued: false,
                required: false,
                mutability: 'readWrite',
                returned: 'default',
              },
            ],
          },
          {
            name: 'active',
            type: 'boolean',
            multiValued: false,
            required: false,
            mutability: 'readWrite',
            returned: 'default',
          },
          {
            name: 'roles',
            type: 'complex',
            multiValued: true,
            required: false,
            mutability: 'readWrite',
            returned: 'default',
            subAttributes: [
              {
                name: 'value',
                type: 'string',
                multiValued: false,
                required: true,
                mutability: 'readWrite',
                returned: 'default',
              },
              {
                name: 'type',
                type: 'string',
                multiValued: false,
                required: false,
                mutability: 'readWrite',
                returned: 'default',
              },
            ],
          },
        ],
        meta: {
          resourceType: 'Schema',
          location: '/scim/v2/Schemas/' + SCIM_CORE_USER_SCHEMA,
        },
      },
    ],
  });
}

/**
 * GET /scim/v2/ResourceTypes
 * Returns the supported resource types
 */
function getResourceTypes(_req: Request, res: Response): void {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 1,
    Resources: [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: SCIM_CORE_USER_SCHEMA,
        meta: {
          resourceType: 'ResourceType',
          location: '/scim/v2/ResourceTypes/User',
        },
      },
    ],
  });
}

