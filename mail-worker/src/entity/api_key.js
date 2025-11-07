import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const apiKey = sqliteTable('api_key', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: integer('user_id').notNull(),
	description: text('description'),
	keyPrefix: text('key_prefix').notNull(),
	hashedKey: text('hashed_key').notNull(),
	createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
	lastUsedAt: text('last_used_at'),
	expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
	scopes: text('scopes').notNull()
});

export default apiKey;