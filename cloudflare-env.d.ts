declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD_HASH?: string;
    SHEET_SYNC_TOKEN?: string;
    BUCKET?: R2Bucket;
    PUBLIC_SITE_ORIGIN?: string;
    GOOGLE_SITE_VERIFICATION?: string;
  }
}
