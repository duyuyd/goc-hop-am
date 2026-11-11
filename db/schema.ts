import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const accounts = sqliteTable('accounts', {
 id:text('id').primaryKey(), username:text('username').notNull().unique(), name:text('name').notNull(),
 passwordHash:text('password_hash').notNull(), role:text('role').notNull().default('member'), createdAt:integer('created_at').notNull()
});
export const accountSessions = sqliteTable('account_sessions', {
 tokenHash:text('token_hash').primaryKey(), accountId:text('account_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}), expiresAt:integer('expires_at').notNull()
});
export const authLimits = sqliteTable('auth_limits', {key:text('key').primaryKey(),bucket:integer('bucket').notNull(),attempts:integer('attempts').notNull()});
export const communitySongs = sqliteTable('community_songs', {
 id:text('id').primaryKey(),title:text('title').notNull(),author:text('author').notNull(),genre:text('genre').notNull(),rhythm:text('rhythm').notNull(),key:text('key').notNull(),
 content:text('content').notNull(),published:integer('published').notNull().default(1),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
});
export const siteSettings = sqliteTable('site_settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const accountBookmarks = sqliteTable('account_bookmarks',{accountId:text('account_id').primaryKey().references(()=>accounts.id,{onDelete:'cascade'}),payload:text('payload').notNull(),updatedAt:integer('updated_at').notNull()});
export const musicCache = sqliteTable('music_cache', {
 key:text('key').primaryKey(),payload:text('payload').notNull(),updatedAt:integer('updated_at').notNull()
});
export const googleIdentities=sqliteTable('google_identities',{
 subject:text('subject').primaryKey(),accountId:text('account_id').notNull().references(()=>accounts.id,{onDelete:'cascade'}),email:text('email').notNull(),createdAt:integer('created_at').notNull()
});
export const googleNonces=sqliteTable('google_nonces',{hash:text('hash').primaryKey(),expiresAt:integer('expires_at').notNull()});
export const storeProducts=sqliteTable('store_products',{
 id:text('id').primaryKey(),title:text('title').notNull(),description:text('description').notNull(),kind:text('kind').notNull().default('sale'),cover:text('cover').notNull(),pages:integer('pages').notNull(),bytes:integer('bytes').notNull(),sha256:text('sha256').notNull(),fileKey:text('file_key').notNull(),priceVnd:integer('price_vnd').notNull().default(0),selling:integer('selling').notNull().default(0),updatedAt:integer('updated_at').notNull()
});
export const storeOrders=sqliteTable('store_orders',{
 id:text('id').primaryKey(),accountId:text('account_id').notNull().references(()=>accounts.id),productId:text('product_id').notNull().references(()=>storeProducts.id),title:text('title').notNull(),amountVnd:integer('amount_vnd').notNull(),status:text('status').notNull().default('pending'),paymentRef:text('payment_ref').notNull().default(''),buyerNote:text('buyer_note').notNull().default(''),adminNote:text('admin_note').notNull().default(''),reviewedBy:text('reviewed_by').references(()=>accounts.id),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),reviewedAt:integer('reviewed_at')
},table=>[uniqueIndex('one_open_order').on(table.accountId,table.productId).where(sql`${table.status} in ('pending','review')`)]);

/** Independently imported, verifiable song catalogue. Existing community_songs is preserved. */
export const songs = sqliteTable('songs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  artist: text('artist').notNull().default(''),
  slug: text('slug').notNull().unique(),
  chordsText: text('chords_text').notNull().default(''),
  lyricsText: text('lyrics_text').notNull().default(''),
  hasPdf: integer('has_pdf').notNull().default(0),
  pdfUrl: text('pdf_url'),
  sheetKey: text('sheet_key'),
  sheetMime: text('sheet_mime'),
  sheetUrl: text('sheet_url'),
  sourceName: text('source_name').notNull().default('Tệp nhập'),
  createdAt: integer('created_at').notNull(),
}, table => [
  index('songs_title_idx').on(table.title),
  index('songs_artist_idx').on(table.artist),
  index('songs_created_at_idx').on(table.createdAt),
  index('songs_sheet_key_idx').on(table.sheetKey),
]);

export const syncLogs = sqliteTable('sync_logs', {
  id: text('id').primaryKey(),
  totalFetched: integer('total_fetched').notNull().default(0),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
  syncedAt: integer('synced_at').notNull(),
}, table => [
  index('sync_logs_synced_at_idx').on(table.syncedAt),
]);
