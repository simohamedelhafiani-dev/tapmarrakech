# Smart Marketing configs — RLS test matrix

Environment: **Staging only**. Never use Production for these tests.

## Automated structural check
Run `supabase/tests/smart_marketing_configs_security.sql` in a read-only/controlled Staging SQL session. It checks RLS enabled, four named policies, Smart ID allowlist, tenant+Smart uniqueness, and audit trigger. The SQL rolls back.

## Authenticated tenant behavior (must be run with test accounts)
Prepare establishment A and B and test users: owner/responsible A, member A without manager rights, user B, and admin.

| Actor | Read A | Read B | Insert/update A | Insert/update B |
|---|---:|---:|---:|---:|
| Responsible/owner A | Allow | Deny | Allow | Deny |
| Member A without write role | Allow | Deny | Deny | Deny |
| Responsible/owner B | Deny | Allow | Deny | Allow |
| Admin | Allow | Allow | Allow | Allow |

Also verify:
- UPDATE cannot move a row from establishment A to B unless the actor has write rights to both (RLS USING + WITH CHECK).
- DELETE follows the same manager/owner/admin rule.
- Unauthenticated requests see no rows and cannot write.
- The UI switching establishment loads only the new establishment's rows; delayed responses from the previous establishment must not overwrite the current view.
- Simulate network/RLS failure: the switch/config save must not show success, and local state must not falsely claim the change persisted.

**Status:** matrix not executed; requires authenticated Staging fixtures and SQL migration applied to Staging by an authorized operator.
