/**
 * SCIM Users Controller
 * 
 * Handles incoming SCIM User requests from Alice and forwards them to LaunchDarkly.
 */

import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppConfig } from '../../config/index.js';
import { LaunchDarklyScimClient, LdScimError } from '../client/launchdarkly.js';
import { ScimCoreUser, ScimPatchRequest, createScimError, SCIM_CORE_USER_SCHEMA } from '../schemas/core.js';
import { LD_SCIM_EXTENSION_SCHEMA, LdScimUserResponse } from '../schemas/launchdarkly.js';
import { transformAliceUserToLdUser, extractCustomRolesFromAliceUser, shouldUpdateRoles } from '../../mapping/transformer.js';
import {
  createUserMapping,
  getUserMappingByAliceId,
  getUserMappingByExternalId,
  updateUserMapping,
  deleteUserMapping,
  getAllUserMappings,
} from '../../db/user-mapping.js';
import { logger } from '../../middleware/logging.js';

/**
 * Create the users controller with dependencies
 */
export function createUsersController(config: AppConfig, ldClient: LaunchDarklyScimClient) {
  return {
    /**
     * POST /scim/v2/Users - Create a new user
     */
    async createUser(req: Request, res: Response): Promise<void> {
      try {
        const aliceUser = req.body as ScimCoreUser;

        logger.info({ userName: aliceUser.userName, externalId: aliceUser.externalId }, 'Creating user');

        // Check if user already exists (by externalId)
        if (aliceUser.externalId) {
          const existingMapping = getUserMappingByExternalId(aliceUser.externalId);
          if (existingMapping) {
            logger.warn({ externalId: aliceUser.externalId }, 'User already exists');
            res.status(409).json(createScimError(409, 'User already exists', 'uniqueness'));
            return;
          }
        }

        // Check if user already exists in LD by userName
        const existingLdUser = await ldClient.findUserByUserName(aliceUser.userName);
        if (existingLdUser) {
          // User exists in LD but not in our mapping - create mapping and return
          const aliceId = uuidv4();
          createUserMapping(
            aliceId,
            aliceUser.externalId || null,
            existingLdUser.id,
            existingLdUser.userName
          );

          // Update the user's roles in LD
          const customRoles = extractCustomRolesFromAliceUser(aliceUser, config.mappings);
          if (customRoles.length > 0) {
            await ldClient.updateUserCustomRoles(existingLdUser.id, customRoles);
          }

          logger.info({ userName: aliceUser.userName, ldId: existingLdUser.id }, 'Linked existing LD user');

          res.status(201)
            .header('Location', `${req.baseUrl}/Users/${aliceId}`)
            .json(transformLdResponseToAliceResponse(existingLdUser, aliceId, req.baseUrl));
          return;
        }

        // Transform Alice user to LD user
        const ldUserPayload = transformAliceUserToLdUser(aliceUser, config.mappings);

        // Create user in LaunchDarkly
        const ldUser = await ldClient.createUser(ldUserPayload);

        // Store the ID mapping
        const aliceId = uuidv4();
        createUserMapping(
          aliceId,
          aliceUser.externalId || null,
          ldUser.id,
          ldUser.userName
        );

        logger.info({ userName: aliceUser.userName, aliceId, ldId: ldUser.id }, 'User created successfully');

        // Return SCIM response
        const response = transformLdResponseToAliceResponse(ldUser, aliceId, req.baseUrl);
        res.status(201)
          .header('Location', `${req.baseUrl}/Users/${aliceId}`)
          .json(response);
      } catch (error) {
        handleError(error, res);
      }
    },

    /**
     * GET /scim/v2/Users/:id - Get a user by ID
     */
    async getUser(req: Request, res: Response): Promise<void> {
      try {
        const aliceId = req.params.id;

        const mapping = getUserMappingByAliceId(aliceId);
        if (!mapping) {
          res.status(404).json(createScimError(404, 'User not found', 'noTarget'));
          return;
        }

        const ldUser = await ldClient.getUser(mapping.ldId);
        const response = transformLdResponseToAliceResponse(ldUser, aliceId, req.baseUrl);
        res.json(response);
      } catch (error) {
        handleError(error, res);
      }
    },

    /**
     * GET /scim/v2/Users - List users with optional filter
     */
    async listUsers(req: Request, res: Response): Promise<void> {
      try {
        const filter = req.query.filter as string | undefined;
        const startIndex = parseInt(req.query.startIndex as string) || 1;
        const count = parseInt(req.query.count as string) || 100;

        logger.debug({ filter, startIndex, count }, 'Listing users');

        // Get all our mappings
        const mappings = getAllUserMappings();

        // If there's a userName filter, apply it
        let filteredMappings = mappings;
        if (filter) {
          const match = filter.match(/userName\s+eq\s+"([^"]+)"/i);
          if (match) {
            const userName = match[1];
            filteredMappings = mappings.filter((m) => m.ldUserName === userName);
          }
        }

        // Paginate
        const paginatedMappings = filteredMappings.slice(startIndex - 1, startIndex - 1 + count);

        // Fetch user details from LD for each mapping
        const resources = await Promise.all(
          paginatedMappings.map(async (mapping) => {
            try {
              const ldUser = await ldClient.getUser(mapping.ldId);
              return transformLdResponseToAliceResponse(ldUser, mapping.aliceId, req.baseUrl);
            } catch {
              // User might have been deleted from LD
              return null;
            }
          })
        );

        res.json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
          totalResults: filteredMappings.length,
          startIndex,
          itemsPerPage: paginatedMappings.length,
          Resources: resources.filter(Boolean),
        });
      } catch (error) {
        handleError(error, res);
      }
    },

    /**
     * PUT /scim/v2/Users/:id - Replace a user
     */
    async replaceUser(req: Request, res: Response): Promise<void> {
      try {
        const aliceId = req.params.id;
        const aliceUser = req.body as ScimCoreUser;

        logger.info({ aliceId, userName: aliceUser.userName }, 'Replacing user');

        const mapping = getUserMappingByAliceId(aliceId);
        if (!mapping) {
          res.status(404).json(createScimError(404, 'User not found', 'noTarget'));
          return;
        }

        // Transform and replace in LD
        const ldUserPayload = transformAliceUserToLdUser(aliceUser, config.mappings);
        const ldUser = await ldClient.replaceUser(mapping.ldId, ldUserPayload);

        // Update mapping if userName changed
        if (ldUser.userName !== mapping.ldUserName) {
          updateUserMapping(aliceId, { ldUserName: ldUser.userName });
        }

        const response = transformLdResponseToAliceResponse(ldUser, aliceId, req.baseUrl);
        res.json(response);
      } catch (error) {
        handleError(error, res);
      }
    },

    /**
     * PATCH /scim/v2/Users/:id - Partially update a user
     */
    async patchUser(req: Request, res: Response): Promise<void> {
      try {
        const aliceId = req.params.id;
        const patchRequest = req.body as ScimPatchRequest;

        logger.info({ aliceId, operations: patchRequest.Operations?.length }, 'Patching user');

        const mapping = getUserMappingByAliceId(aliceId);
        if (!mapping) {
          res.status(404).json(createScimError(404, 'User not found', 'noTarget'));
          return;
        }

        // Process patch operations
        // We need to translate role-related patches
        const ldOperations = patchRequest.Operations.map((op) => {
          // If patching 'active', pass through
          if (op.path === 'active') {
            return op;
          }

          // If patching 'roles', translate to LD customRoles
          if (op.path === 'roles') {
            const roles = Array.isArray(op.value) ? op.value : [];
            const customRoles = roles
              .map((r: { value: string }) => {
                const roleMapping = config.mappings.roleMappings.find(
                  (m) => m.aliceRole === r.value
                );
                return roleMapping?.ldCustomRoles || [];
              })
              .flat();

            return {
              op: op.op,
              path: LD_SCIM_EXTENSION_SCHEMA,
              value: { customRole: customRoles },
            };
          }

          // Pass through other operations
          return op;
        });

        const ldUser = await ldClient.patchUser(mapping.ldId, ldOperations);
        const response = transformLdResponseToAliceResponse(ldUser, aliceId, req.baseUrl);
        res.json(response);
      } catch (error) {
        handleError(error, res);
      }
    },

    /**
     * DELETE /scim/v2/Users/:id - Delete/deactivate a user
     */
    async deleteUser(req: Request, res: Response): Promise<void> {
      try {
        const aliceId = req.params.id;

        logger.info({ aliceId }, 'Deleting user');

        const mapping = getUserMappingByAliceId(aliceId);
        if (!mapping) {
          // User doesn't exist - return 204 (idempotent)
          res.status(204).send();
          return;
        }

        // Delete from LaunchDarkly
        try {
          await ldClient.deleteUser(mapping.ldId);
        } catch (error) {
          // If already deleted in LD, continue to clean up mapping
          if (!(error instanceof LdScimError && error.status === 404)) {
            throw error;
          }
        }

        // Remove the mapping
        deleteUserMapping(aliceId);

        logger.info({ aliceId, ldId: mapping.ldId }, 'User deleted successfully');
        res.status(204).send();
      } catch (error) {
        handleError(error, res);
      }
    },
  };
}

/**
 * Transform LD user response to Alice-compatible SCIM response
 */
function transformLdResponseToAliceResponse(
  ldUser: LdScimUserResponse,
  aliceId: string,
  baseUrl: string
): ScimCoreUser {
  // Get the LD extension if present
  const ldExtension = ldUser[LD_SCIM_EXTENSION_SCHEMA];

  // Convert LD customRoles back to SCIM roles for Alice
  // This is informational - Alice sees what roles are actually assigned
  const roles = ldExtension?.customRole?.map((role) => ({
    value: role,
    type: 'launchdarkly',
  })) || [];

  return {
    schemas: [SCIM_CORE_USER_SCHEMA],
    id: aliceId,
    externalId: ldUser.externalId,
    userName: ldUser.userName,
    name: ldUser.name,
    active: ldUser.active,
    roles,
    meta: {
      resourceType: 'User',
      location: `${baseUrl}/Users/${aliceId}`,
      created: ldUser.meta?.created,
      lastModified: ldUser.meta?.lastModified,
    },
  };
}

/**
 * Handle errors and return appropriate SCIM error responses
 */
function handleError(error: unknown, res: Response): void {
  logger.error({ error }, 'Request error');

  if (error instanceof LdScimError) {
    res.status(error.status).json(createScimError(error.status, error.detail));
    return;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  res.status(500).json(createScimError(500, message));
}

