-- Prisma's insensitive contains compiles to lower(col) LIKE '%q%', so the
-- usable trigram index is an EXPRESSION index on lower(col) — the raw-column
-- indexes from search_trgm are dropped and recreated here.
DROP INDEX IF EXISTS leads_first_name_trgm;
DROP INDEX IF EXISTS leads_last_name_trgm;
DROP INDEX IF EXISTS leads_email_trgm;
DROP INDEX IF EXISTS leads_phone_trgm;
DROP INDEX IF EXISTS leads_company_trgm;
DROP INDEX IF EXISTS contacts_first_name_trgm;
DROP INDEX IF EXISTS contacts_last_name_trgm;
DROP INDEX IF EXISTS contacts_email_trgm;
DROP INDEX IF EXISTS accounts_name_trgm;
DROP INDEX IF EXISTS accounts_industry_trgm;
DROP INDEX IF EXISTS customers_first_name_trgm;
DROP INDEX IF EXISTS customers_last_name_trgm;
DROP INDEX IF EXISTS customers_email_trgm;
DROP INDEX IF EXISTS opportunities_name_trgm;
DROP INDEX IF EXISTS tasks_title_trgm;

CREATE INDEX leads_first_name_trgm ON "Lead" USING gin (lower("firstName") gin_trgm_ops);
CREATE INDEX leads_last_name_trgm ON "Lead" USING gin (lower("lastName") gin_trgm_ops);
CREATE INDEX leads_email_trgm ON "Lead" USING gin (lower("email") gin_trgm_ops);
CREATE INDEX leads_company_trgm ON "Lead" USING gin (lower("company") gin_trgm_ops);
CREATE INDEX contacts_first_name_trgm ON "Contact" USING gin (lower("firstName") gin_trgm_ops);
CREATE INDEX contacts_last_name_trgm ON "Contact" USING gin (lower("lastName") gin_trgm_ops);
CREATE INDEX contacts_email_trgm ON "Contact" USING gin (lower("email") gin_trgm_ops);
CREATE INDEX accounts_name_trgm ON "Account" USING gin (lower("name") gin_trgm_ops);
CREATE INDEX accounts_industry_trgm ON "Account" USING gin (lower("industry") gin_trgm_ops);
CREATE INDEX customers_first_name_trgm ON "Customer" USING gin (lower("firstName") gin_trgm_ops);
CREATE INDEX customers_last_name_trgm ON "Customer" USING gin (lower("lastName") gin_trgm_ops);
CREATE INDEX customers_email_trgm ON "Customer" USING gin (lower("email") gin_trgm_ops);
CREATE INDEX opportunities_name_trgm ON "Opportunity" USING gin (lower("name") gin_trgm_ops);
CREATE INDEX tasks_title_trgm ON "Task" USING gin (lower("title") gin_trgm_ops);
