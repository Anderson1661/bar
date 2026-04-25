-- =============================================
-- Migración 003: Sesiones, Seguridad, Auditoría avanzada, Promociones
-- =============================================

USE fullgas_db;

-- =============================================
-- SESIONES DE USUARIO
-- =============================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id            INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED   NOT NULL,
  session_token VARCHAR(255)   NOT NULL UNIQUE,
  device_info   VARCHAR(255),
  ip_address    VARCHAR(45),
  created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at    DATETIME       NOT NULL,
  last_used_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at    DATETIME,
  revoke_reason VARCHAR(100),
  is_active     BOOLEAN        NOT NULL DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_token  (session_token),
  INDEX idx_sessions_user   (user_id),
  INDEX idx_sessions_active (is_active, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- PREGUNTAS DE SEGURIDAD
-- =============================================

CREATE TABLE IF NOT EXISTS security_questions (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question   VARCHAR(255) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO security_questions (id, question, sort_order) VALUES
  (1,  '¿Cuál es el nombre de tu primera mascota?', 1),
  (2,  '¿En qué ciudad naciste?', 2),
  (3,  '¿Cuál es el nombre de soltera de tu madre?', 3),
  (4,  '¿Cuál fue el nombre de tu primera escuela?', 4),
  (5,  '¿Cuál es el nombre de tu mejor amigo de infancia?', 5),
  (6,  '¿Cuál era la marca de tu primer coche?', 6),
  (7,  '¿Cuál es tu película favorita de la infancia?', 7),
  (8,  '¿Cuál es el apellido de tu profesor favorito?', 8),
  (9,  '¿En qué calle creciste?', 9),
  (10, '¿Cuál es el segundo nombre de tu padre?', 10);

-- =============================================
-- RESPUESTAS DE SEGURIDAD DE USUARIOS
-- =============================================

CREATE TABLE IF NOT EXISTS user_security_answers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  question_id INT UNSIGNED NOT NULL,
  answer_hash VARCHAR(255) NOT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_question (user_id, question_id),
  FOREIGN KEY (user_id)     REFERENCES users(id)               ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES security_questions(id)  ON DELETE RESTRICT,
  INDEX idx_answers_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- INTENTOS DE RECUPERACIÓN DE CONTRASEÑA
-- =============================================

CREATE TABLE IF NOT EXISTS password_reset_attempts (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED,
  username    VARCHAR(50),
  ip_address  VARCHAR(45),
  success     BOOLEAN      NOT NULL DEFAULT FALSE,
  fail_reason VARCHAR(100),
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_reset_user    (user_id),
  INDEX idx_reset_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- AUDIT_LOGS: campos adicionales
-- =============================================

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS role_name    VARCHAR(50)    NULL AFTER username,
  ADD COLUMN IF NOT EXISTS session_id   INT UNSIGNED   NULL AFTER new_values,
  ADD COLUMN IF NOT EXISTS device_info  VARCHAR(255)   NULL AFTER session_id,
  ADD COLUMN IF NOT EXISTS ip_address   VARCHAR(45)    NULL AFTER device_info,
  ADD COLUMN IF NOT EXISTS result       ENUM('success','failure') NOT NULL DEFAULT 'success' AFTER ip_address,
  ADD COLUMN IF NOT EXISTS reason       VARCHAR(255)   NULL AFTER result;

-- =============================================
-- PROMOTIONS: campos adicionales
-- =============================================

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN          NOT NULL DEFAULT FALSE AFTER is_active,
  ADD COLUMN IF NOT EXISTS priority   TINYINT UNSIGNED NOT NULL DEFAULT 0     AFTER auto_apply,
  ADD COLUMN IF NOT EXISTS updated_by INT UNSIGNED     NULL                   AFTER created_by;

-- Agregar FK solo si no existe (MySQL 8 no soporta ADD CONSTRAINT IF NOT EXISTS)
SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'promotions'
    AND CONSTRAINT_NAME = 'fk_promotions_updated_by'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE promotions ADD CONSTRAINT fk_promotions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- SYSTEM_SETTINGS: configuración de sesiones
-- =============================================

INSERT IGNORE INTO system_settings (key_name, value, description) VALUES
  ('session_timeout_minutes',  '480', 'Minutos de inactividad antes de cerrar sesión automáticamente'),
  ('session_max_hours',        '24',  'Duración máxima de una sesión activa en horas'),
  ('max_reset_attempts',       '5',   'Intentos máximos de recuperación de contraseña por hora');
