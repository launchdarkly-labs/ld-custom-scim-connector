## Background & Problem Statement
Mercedes-Benz uses a homegrown Identity Provider referred to as ‘Alice’ as the authoritative source for user identity and authorization. Alice supports core SCIM 2.0 schemas (Users & Groups) but does not support SCIM schema extensions.

LaunchDarkly (LD) requires:
- Standard SCIM core user data (givenName, familyName, NameID, active state)
- Custom SCIM attributes for authorization:
  - role - assigns LaunchDarkly built-in roles (admin, reader, writer, etc.)
  - customRole - assigns LD custom-defined roles
  - roleAttributes - additional values to manage scoped/custom roles

These authorization attributes are delivered through a LaunchDarkly SCIM schema extension, which Alice cannot generate.

Additionally, LD can create accounts through Just-In-Time (JIT) provisioning during SAML login. However, Alice does not provide an interface that allows users to initiate their first SSO login, making JIT provisioning insufficient for initial account creation.

Therefore, we must provide a mechanism that:
- Automatically creates and deactivates users in LaunchDarkly
- Synchronizes Alice’s authorization model (groups, roles, entitlements) with LaunchDarkly built-in and custom roles
- Does not require user-initiated SSO login for initial provisioning

## Objectives

- Ensure LaunchDarkly accounts are created for all relevant Alice users without requiring an initial SSO login.
- Ensure LD role assignments are automatically derived from Alice roles and groups.
- Maintain a clear, auditable mapping between Alice authorization and LaunchDarkly permissions.
- Minimize operational overhead and system complexity for engineering and identity teams.
- Provide a future-proof, extensible interface for ongoing LD access management.


## Proposed Solution: Custom SCIM Middleware (“SCIM Gateway”)
Overview
A new service (“SCIM Gateway”) is introduced as an intermediary between Alice and LaunchDarkly.
It functions as:

- A SCIM Service Provider from Alice’s perspective
- A SCIM Client to LaunchDarkly

Its purpose is to translate core SCIM data from Alice into LaunchDarkly’s extended SCIM schema and ensure that LD receives all required custom authorization attributes.

This approach fully automates user lifecycle management and role provisioning end-to-end.

### Capability Summary
The SCIM Gateway must:

1. Accept SCIM 2.0 User and Group objects from Alice
2. Store minimal correlation identifiers (Alice user → LD user)
3. Translate authorization attributes:
  a. roles → LD role or customRole[]
  b. entitlements → LD roleAttributes[]
  c. Group membership → computed LD role definitions
4. Invoke LaunchDarkly’s SCIM API using POST, PATCH, and DELETE
5. Return standard SCIM responses back to Alice
6. Expose logs and metrics for sync success, failures, and retries
7. Provide configurable mapping rules between Alice authorization and LD roles
8. Support ongoing changes without requiring code modification

## Details of LD SCIM endpoint

Documentation: https://launchdarkly.com/docs/home/account/saml#set-custom-attributes

These attributes are available for SAML SSO provisioning and SCIM provisioning:

| Attribute name | Attribute format                              | Availability | Description |
|----------------|-----------------------------------------------|--------------|-------------|
| role           | string                                        | SSO and SCIM | One of the base LaunchDarkly roles: `reader`, `writer`, `admin`, and for some customers, `no_access`. If unspecified, the default role is `reader`. If you prefer to continue to manage member roles within LaunchDarkly, you can leave this blank. SCIM attribute name: `urn:ietf:params:scim:schemas:extension:launchdarkly:2.0:User:role` |
| customRole     | String array, or comma-separated string       | SSO and SCIM | A list of the keys of the custom roles to assign to the account member. These replace the member’s existing custom roles. If a member has any custom roles, they supersede the base role. The elements of the `customRole` list are case-sensitive, and each element must match a custom role key in LaunchDarkly exactly. If you prefer to continue to manage member roles within LaunchDarkly, you can leave this blank. SCIM attribute name: `urn:ietf:params:scim:schemas:extension:launchdarkly:2.0:User:customRole` |
| teamKey        | String array, or comma-separated string       | SSO only     | A list of the keys of the teams that the account member belongs to. These replace the member’s existing teams. The elements of the `teamKey` list are case-sensitive, and each element must match a team key in LaunchDarkly exactly. If you prefer to continue to manage team membership within LaunchDarkly, you can leave this blank. To learn more about Teams, read *Teams*. To learn about managing teams with SCIM, read *Team sync with SCIM*. |

SAML SSO supports the following naming attributes:
- firstName
- lastName

SCIM provisioning uses the standard naming attributes:
- givenName
- familyName

### Teams sync between IdP and LD

Documentation: https://launchdarkly.com/docs/home/account/scim#team-sync-with-scim

## Details of the schemas supported by Alice

Documentation: https://www.rfc-editor.org/rfc/rfc7643#section-4.1.2

The User schema is: urn:ietf:params:scim:schemas:core:2.0:User
The Group schema: urn.ietf:params:scim:schemas:core:2.0:Group

roles
      A list of roles for the user that collectively represent who the
      user is, e.g., "Student", "Faculty".  No vocabulary or syntax is
      specified, although it is expected that a role value is a String
      or label representing a collection of entitlements.  This value
      has no canonical types.

groups
      A list of groups to which the user belongs, either through direct
      membership, through nested groups, or dynamically calculated.  The
      values are meant to enable expression of common group-based or
      role-based access control models, although no explicit
      authorization model is defined.  It is intended that the semantics
      of group membership and any behavior or authorization granted as a
      result of membership are defined by the service provider.  The
      canonical types "direct" and "indirect" are defined to describe
      how the group membership was derived.  Direct group membership
      indicates that the user is directly associated with the group and
      SHOULD indicate that clients may modify membership through the
      "Group" resource.  Indirect membership indicates that user
      membership is transitive or dynamic and implies that clients
      cannot modify indirect group membership through the "Group"
      resource but MAY modify direct group membership through the
      "Group" resource, which may influence indirect memberships.  If
      the SCIM service provider exposes a "Group" resource, the "value"
