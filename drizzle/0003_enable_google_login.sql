-- Custom SQL migration file, put your code below! --
-- Public OAuth client identifier supplied by the website owner.
-- Configure once; later owner changes in Admin remain authoritative.
INSERT INTO site_settings (key, value)
VALUES ('google_client_id', '1053077701701-5e1q3ptgkhqt45sru4c0edh15oat18gv.apps.googleusercontent.com')
ON CONFLICT(key) DO UPDATE SET value=excluded.value;
