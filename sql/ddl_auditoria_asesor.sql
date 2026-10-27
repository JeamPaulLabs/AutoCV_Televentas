-- Auditorías de Como Vamos por asesor (las hace Martha desde la pestaña
-- "Auditoría"). Cada guardado es una fila nueva: nunca se sobrescribe, así
-- queda el historial (se espera ~una cada 15 días, pero puede haber varias).
-- La API crea esta tabla sola la primera vez si su usuario tiene permiso; si no,
-- ejecutar este script en DataCenter_Vanti.

CREATE TABLE IF NOT EXISTS como_vamos_televentas.auditoria_asesor (
    id                   BIGSERIAL PRIMARY KEY,
    periodo              DATE        NOT NULL,              -- primer día del mes
    fecha_corte          DATE        NOT NULL,              -- corte del tablero auditado
    asesor               TEXT        NOT NULL,
    asesor_norm          TEXT        NOT NULL,
    auditor_id           INTEGER     NOT NULL,              -- sub del JWT (quién auditó)
    auditor_nombre       TEXT,
    items                JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- {"meta": true, ...}
    resultado            TEXT        NOT NULL
                         CHECK (resultado IN ('conforme', 'con_observaciones', 'requiere_revision')),
    observaciones        TEXT,
    dias_calendario      INTEGER,                           -- días laborados según calendario
    dias_ajustados       INTEGER,                           -- días laborados ajustados por Martha
    fechas_no_laboradas  JSONB       NOT NULL DEFAULT '[]'::jsonb,
    motivo_dias          TEXT,
    novedades            JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{tipo, desde, hasta, nota, afecto_ventas}]
    canceladas_audio     JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- contratos marcados como falla de audio
    sugerencias          JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- lo que mostraba el sistema al guardar
    resumen              JSONB       NOT NULL DEFAULT '{}'::jsonb,  -- meta, acumulado, % al momento de guardar
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_auditoria_asesor_periodo
    ON como_vamos_televentas.auditoria_asesor (periodo, asesor_norm, creado_en DESC);
