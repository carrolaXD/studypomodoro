CREATE TABLE feedback (
    id TEXT PRIMARY KEY NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    category TEXT NOT NULL CHECK (category IN ('bug', 'suggestion', 'general')),
    language TEXT NOT NULL CHECK (language IN ('en', 'pt')),
    message TEXT NOT NULL,
    email TEXT
);
CREATE INDEX feedback_by_date ON feedback (created_at DESC);
