INSERT INTO app_users(id,email,display_name,role,status,created_at,updated_at,payload)
VALUES('user-courtwatch-ci','courtwatch-ci@service.invalid','CourtWatch CI','user','active',datetime('now'),datetime('now'),'{"purpose":"isolated-authenticated-crud-smoke"}')
ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,role='user',status='active',updated_at=datetime('now'),payload=excluded.payload;

DELETE FROM user_app_players WHERE user_id='user-courtwatch-ci';
