-- 003: Ganti ID perusahaan tenant '99999' -> '001' (lebih ringkas untuk kasir).
-- Idempoten: bila companies '99999' sudah tidak ada, seluruh blok dilewati.
--
-- Kolom company_id di banyak tabel ber-FK ke companies(id) tanpa ON UPDATE
-- CASCADE, sehingga FK dilepas sementara lalu dipasang kembali setelah
-- PK dan seluruh data turunan diperbarui.

DO $$
DECLARE
  r RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = '99999') THEN
    RAISE NOTICE '003: companies dengan id 99999 tidak ditemukan, dilewati.';
    RETURN;
  END IF;

  -- Simpan daftar FK yang menunjuk companies(id), lalu lepas.
  CREATE TEMP TABLE _company_fks AS
    SELECT conrelid::regclass::text AS tbl, conname
    FROM pg_constraint
    WHERE confrelid = 'companies'::regclass AND contype = 'f';

  FOR r IN SELECT tbl, conname FROM _company_fks LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;

  UPDATE companies SET id = '001' WHERE id = '99999';

  -- Perbarui seluruh kolom company_id pada tabel publik apa pun.
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_attribute a
      ON a.attrelid = c.relid AND a.attname = 'company_id'
    WHERE c.relkind = 'r'
      AND c.relnamespace = 'public'::regnamespace
      AND a.attnum > 0
      AND NOT a.attisdropped
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET company_id = %L WHERE company_id = %L',
      r.tbl, '001', '99999'
    );
  END LOOP;

  -- Pasang kembali FK (semuanya pola yang sama: company_id -> companies.id).
  FOR r IN SELECT tbl, conname FROM _company_fks LOOP
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE',
      r.tbl, r.conname
    );
  END LOOP;

  DROP TABLE _company_fks;
  RAISE NOTICE '003: ID perusahaan diganti 99999 -> 001.';
END $$;
