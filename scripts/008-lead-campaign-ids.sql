ALTER TABLE leads
ADD COLUMN IF NOT EXISTS campaign_ids UUID[] DEFAULT '{}'::uuid[];

UPDATE leads
SET campaign_ids = '{}'::uuid[]
WHERE campaign_ids IS NULL;

UPDATE leads
SET campaign_ids = sub.campaign_ids
FROM (
  SELECT
    lead_id,
    ARRAY_AGG(DISTINCT campaign_id) FILTER (WHERE campaign_id IS NOT NULL) AS campaign_ids
  FROM generated_messages
  GROUP BY lead_id
) AS sub
WHERE leads.id = sub.lead_id
  AND COALESCE(array_length(leads.campaign_ids, 1), 0) = 0;

CREATE INDEX IF NOT EXISTS idx_leads_campaign_ids ON leads USING GIN (campaign_ids);
