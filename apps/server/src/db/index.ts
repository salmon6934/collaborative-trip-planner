import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://tripplanner:tripplanner_dev@localhost:5432/tripplanner';

// Connection pool for queries
const client = postgres(connectionString);

export const db = drizzle(client, { schema });

export { client };
