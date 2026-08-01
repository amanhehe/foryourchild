-- Raw clickstream events (learning_events) are private to the account that
-- generated them and to admin/research accounts only. Teachers get pupil
-- *progress* (level, XP, streak, literacy_score, quiz_attempts) through the
-- classroom pupil views instead — never the raw event-level clickstream.
--
-- This closes an unintended leak: the old "Teachers read events for their
-- pupils" policy let a teacher's own /activity query return every click,
-- page view and pronunciation attempt logged by their pupils' accounts,
-- not just the teacher's own activity.
DROP POLICY IF EXISTS "Teachers read events for their pupils" ON public.learning_events;
