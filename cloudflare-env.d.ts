declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD_HASH?: string;
    BUCKET?: R2Bucket;
    AI_TRANSCRIBE_URL?: string;
    AI_TRANSCRIBE_TOKEN?: string;
    PUBLIC_SITE_ORIGIN?: string;
    GOOGLE_SITE_VERIFICATION?: string;
  }
}
