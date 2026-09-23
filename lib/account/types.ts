// Framework-free types shared by lib/account/**. `AccountClient` is a narrow
// structural subset of the Prisma client (only the delegates/methods the
// account core actually calls), mirroring `lib/employees/types.ts`'s
// `EmployeesClient`, so tests can pass an in-memory fake instead of a real
// Prisma client. Production code passes the real `prisma` — it satisfies
// this shape structurally, no adapter needed. `$transaction` is included
// because `changePassword` (D-179) updates the password hash and revokes
// other sessions/tokens atomically.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any;

export type AccountClient = {
  user: {
    update(args: Args): Promise<Args>;
  };
  userSession: {
    findMany(args: Args): Promise<Args>;
    findUnique(args: Args): Promise<Args>;
    count(args: Args): Promise<Args>;
    updateMany(args: Args): Promise<Args>;
  };
  refreshToken: {
    findMany(args: Args): Promise<Args>;
    findUnique(args: Args): Promise<Args>;
    count(args: Args): Promise<Args>;
    updateMany(args: Args): Promise<Args>;
  };
  $transaction<T>(fn: (tx: AccountClient) => Promise<T>): Promise<T>;
};
