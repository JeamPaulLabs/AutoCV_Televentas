-- Auditorías de Como Vamos por asesor, en dos miradas (comercial = coordinación,
-- interna = auditoría de calidad) y el hilo de seguimiento compartido. Cada
-- guardado es una fila nueva (historial). La API crea estas tablas sola la
-- primera vez (el DDL está embebido en backend/app/routers/auditoria.py);
-- este archivo es copia por si hay que ejecutarlo a mano en DataCenter_Vanti.

CREATE TABLE IF NOT EXISTS como_vamos_televentas.auditoria_asesor (
    id                   BIGSERIAL PRIMARY KEY,
    tipo                 TEXT        NOT NULL DEFAULT 'comercial'
                         CHECK (tipo IN ('comercial', 'interna')),
    periodo              DATE        NOT NULL,
    fecha_corte          DATE        NOT NULL,
    asesor               TEXT        NOT NULL,
    asesor_norm          TEXT        NOT NULL,
    auditor_id           INTEGER     NOT NULL,
    auditor_nombre       TEXT,
    items                JSONB       NOT NULL DEFAULT '{}'::jsonb,
    resultado            TEXT        NOT NULL
                         CHECK (resultado IN ('conforme', 'con_observaciones', 'requiere_revision')),
    observaciones        TEXT,
    dias_calendario      INTEGER,
    dias_ajustados       INTEGER,
    fechas_no_laboradas  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    motivo_dias          TEXT,
    novedades            JSONB       NOT NULL DEFAULT '[]'::jsonb,
    canceladas_audio     JSONB       NOT NULL DEFAULT '[]'::jsonb,
    eventualidades       JSONB       NOT NULL DEFAULT '{}'::jsonb,
    sugerencias          JSONB       NOT NULL DEFAULT '[]'::jsonb,
    resumen              JSONB       NOT NULL DEFAULT '{}'::jsonb,
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE como_vamos_televentas.auditoria_asesor
    ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'comercial',
    ADD COLUMN IF NOT EXISTS eventualidades JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS ix_auditoria_asesor_periodo
    ON como_vamos_televentas.auditoria_asesor (periodo, asesor_norm, tipo, creado_en DESC);

CREATE TABLE IF NOT EXISTS como_vamos_televentas.auditoria_seguimiento (
    id            BIGSERIAL PRIMARY KEY,
    periodo       DATE        NOT NULL,
    asesor        TEXT        NOT NULL,
    asesor_norm   TEXT        NOT NULL,
    autor_id      INTEGER     NOT NULL,
    autor_nombre  TEXT,
    rol           TEXT        NOT NULL CHECK (rol IN ('comercial', 'interna')),
    texto         TEXT        NOT NULL,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_auditoria_seguimiento_asesor
    ON como_vamos_televentas.auditoria_seguimiento (periodo, asesor_norm, creado_en);
