CREATE TABLE feedback_notifications (
    id TEXT PRIMARY KEY NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'review')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
    first_attempt_at INTEGER,
    claim_token TEXT,
    sent_at INTEGER,
    last_error TEXT
);

CREATE INDEX feedback_notifications_due
ON feedback_notifications (next_attempt_at, id) WHERE status = 'pending';

CREATE TRIGGER enqueue_feedback_notification
AFTER INSERT ON feedback
BEGIN
    INSERT INTO feedback_notifications (id) VALUES (NEW.id);
END;
