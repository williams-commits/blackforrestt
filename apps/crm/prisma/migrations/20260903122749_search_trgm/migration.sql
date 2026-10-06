-- Global search acceleration: pg_trgm GIN indexes for ILIKE '%q%'.
-- ILIKE on a plain column can use a single-column gin_trgm_ops index; the
-- search provider (src/server/search/pg.ts) queries exactly these columns.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX leads_first_name_trgm ON "Lead" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX leads_last_name_trgm ON "Lead" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX leads_email_trgm ON "Lead" USING gin ("email" gin_trgm_ops);
CREATE INDEX leads_phone_trgm ON "Lead" USING gin ("phone" gin_trgm_ops);
CREATE INDEX leads_company_trgm ON "Lead" USING gin ("company" gin_trgm_ops);

CREATE INDEX contacts_first_name_trgm ON "Contact" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX contacts_last_name_trgm ON "Contact" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX contacts_email_trgm ON "Contact" USING gin ("email" gin_trgm_ops);

CREATE INDEX accounts_name_trgm ON "Account" USING gin ("name" gin_trgm_ops);
CREATE INDEX accounts_industry_trgm ON "Account" USING gin ("industry" gin_trgm_ops);

CREATE INDEX customers_first_name_trgm ON "Customer" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX customers_last_name_trgm ON "Customer" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX customers_email_trgm ON "Customer" USING gin ("email" gin_trgm_ops);

CREATE INDEX opportunities_name_trgm ON "Opportunity" USING gin ("name" gin_trgm_ops);

CREATE INDEX tasks_title_trgm ON "Task" USING gin ("title" gin_trgm_ops);
