# Superadmin controls

Public signup creates an organiser account. To create the first superadmin, sign up for the account you intend to use and run these commands from the project folder:

```sh
npm run db:migrate
npm run admin:bootstrap -- organiser@example.com
```

Replace the sample email with the address of your active account. Sign in again after the command succeeds, then choose **Admin controls** in the organiser space or visit `/admin`. The command works only when the database has no superadmin. After that, use the dashboard to assign roles.

## What the dashboard can do

- Search accounts and open rooms, including rooms hosted by other organisers.
- Suspend or reactivate an account, grant superadmin access, or return another account to the organiser role.
- Restrict new hosting or set a weekly room limit for an account.
- Cancel an open room and enter a reason for joined guests.
- Review the 20 latest successful changes, including who made each change, when, and what it affected.

Role and status changes sign the affected account out everywhere. Reactivation lets the person sign in again. Suspension changes account access. Use room cancellation separately to stop an active quiz. Published results remain in room history.

The API checks permissions even if someone opens an admin URL directly. An admin cannot change their own role or status. PostgreSQL processes admin writes one at a time, so if two admins try to demote each other together, the second request is checked after the first commits. Each successful change and its audit entry are saved in one transaction.

Role changes and organiser suspension require the acting superadmin's current password. Both actions share a limit of five verification requests per account in 15 minutes across sessions and targets. This limit is held in memory by the single API process. Reactivation does not require a password. Suspended organisers must be reactivated before promotion. Superadmin accounts cannot be suspended, including by another superadmin. The server checks these rules again inside the transaction so competing requests cannot bypass them.

## Hosting policy and directory

Use **Hosting policy** on an account to restrict new rooms, remove the restriction, or set a weekly limit. Blank means unlimited and zero means no rooms can open. The week starts Monday at midnight UTC. Successfully opening a room uses one slot, including rooms later closed or cancelled. Drafts and publication do not use slots. Restrictions leave sign-in, draft management, existing rooms, and history available.

Open **Directory** in the header for the read-only directory. Select one or more organisers in the searchable dropdown, or use the separate Search field to match titles, room codes, and organiser names/emails. Combine these with status and either or both dates. Drafted and published apply to competition templates. Live includes waiting and running rooms, ended covers closed rooms without cancellation, and cancelled is separate. Dates are inclusive in UTC and refer to competition creation or room opening.

The directory defaults to 10 records per page. The API accepts page sizes from 1 to 100 and returns a pagination object containing totalElements, currentPage, pageSize, and totalPages. The table offers 10, 25, 50, and 100 rows. Applying filters or changing the page size returns to page one. Filtering happens before counting and pagination.
