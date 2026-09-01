-- Tablas nuevas del esquema como_vamos_televentas para el motor de reporte
-- "Como Vamos" (31_AutoCV_Televentas). El esquema ya existe (lo usa 25_Cantadas
-- para cantadas/log_cantadas); aquí solo se agregan tablas propias de este
-- proyecto -- no se toca nada de cantadas.

CREATE TABLE IF NOT EXISTS como_vamos_televentas.metas (
    id                   BIGSERIAL PRIMARY KEY,
    periodo              DATE NOT NULL,              -- primer día del mes, ej. 2026-08-01
    asesor               VARCHAR NOT NULL,            -- tal cual aparece en el acta
    asesor_norm          TEXT GENERATED ALWAYS AS (
                             upper(trim(regexp_replace(asesor, '\s+', ' ', 'g')))
                         ) STORED,
    categoria            VARCHAR NOT NULL,             -- ALFA / OMEGA / BETA / NOVEDAD
    meta_escala_1        INTEGER NOT NULL,
    base_pago_escala_1   NUMERIC(14, 2) NOT NULL,
    meta_escala_2        INTEGER,
    base_pago_escala_2   NUMERIC(14, 2),
    meta_escala_3        INTEGER,
    base_pago_escala_3   NUMERIC(14, 2),
    fuente               TEXT,                         -- ej. 'ACTAS ASESORES AGOSTO 2026.pdf'
    creado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (periodo, asesor_norm)
);

CREATE INDEX IF NOT EXISTS ix_metas_periodo ON como_vamos_televentas.metas (periodo);

-- Control de cierre: un periodo NO se considera cerrado por calendario, sino
-- porque auditoría lo declara explícitamente (fecha variable, no coincide con
-- fin de mes). Mientras no exista una fila aquí para el periodo, el dashboard
-- sigue leyendo ilio.v_cuota_protegida en vivo aunque el mes calendario ya
-- haya terminado.
CREATE TABLE IF NOT EXISTS como_vamos_televentas.cierres_mes (
    id_cierre            BIGSERIAL PRIMARY KEY,
    periodo              DATE NOT NULL UNIQUE,        -- primer día del mes cerrado
    fecha_cierre          TIMESTAMPTZ NOT NULL DEFAULT now(),
    cerrado_por           VARCHAR NOT NULL,             -- quién en auditoría declaró el cierre
    observaciones          TEXT
);

-- Corte/snapshot congelado de un mes ya cerrado, tomado de ilio.v_cuota_protegida
-- en el momento en que auditoría declara el cierre (ver cierres_mes). Los
-- meses en curso (sin fila en cierres_mes) NO usan esta tabla -- se leen en
-- vivo directo de Ilio.
CREATE TABLE IF NOT EXISTS como_vamos_televentas.cierre_mensual (
    id                   BIGSERIAL PRIMARY KEY,
    id_cierre            BIGINT NOT NULL REFERENCES como_vamos_televentas.cierres_mes (id_cierre),
    periodo              DATE NOT NULL,
    id_poliza            BIGINT NOT NULL,
    fecha_venta          DATE,
    fecha_digitacion     TIMESTAMP,
    asesor               VARCHAR,
    supervisor           VARCHAR,
    estrategia           VARCHAR,
    producto             VARCHAR,
    plan                 VARCHAR,
    colectivo            VARCHAR,
    entidad_facturacion  VARCHAR,
    tarifa               NUMERIC,
    nombre_estado        VARCHAR,
    UNIQUE (periodo, id_poliza)
);

CREATE INDEX IF NOT EXISTS ix_cierre_periodo ON como_vamos_televentas.cierre_mensual (periodo);
CREATE INDEX IF NOT EXISTS ix_cierre_asesor ON como_vamos_televentas.cierre_mensual (asesor);

-- =============================================================================
-- Seed: metas Agosto 2026 -- ACTAS ASESORES AGOSTO 2026.pdf
-- (Xuma, Barranquilla 03-ago-2026, socializacion meta campaña Seguros Vanti)
-- =============================================================================
INSERT INTO como_vamos_televentas.metas
    (periodo, asesor, categoria, meta_escala_1, base_pago_escala_1,
     meta_escala_2, base_pago_escala_2, meta_escala_3, base_pago_escala_3, fuente)
VALUES
    ('2026-08-01', 'ANDERSON MONTERROSA CASTILLA',   'ALFA',    150, 750000,  180, 1080000, 210, 1470000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'JESUS DAVID CORTES ORTEGA',       'ALFA',    150, 750000,  180, 1080000, 210, 1470000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'JOELIS J BARROS B',               'ALFA',    150, 750000,  180, 1080000, 210, 1470000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'LUISA L PERCY JARABA',            'ALFA',    150, 750000,  180, 1080000, 210, 1470000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'MELISSA PAOLA OROZCO JINETE',     'ALFA',    150, 750000,  180, 1080000, 210, 1470000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'NOHELIA H SALAS MONTERROSA',      'ALFA',    150, 750000,  180, 1080000, 210, 1470000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'DAYANA D GUERRERO HERNANDEZ',     'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'ALAN JOSE HERNANDEZ LOAIZA',      'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'CESAR BARRERA PAJARO',            'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'JEAN J GUZMAN',                   'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'LAURA L HERRERA PALOMINO',        'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'RHOYMAR HERNANDEZ ALBARRAN',      'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'ROSALINDA RIVERA SENIOR',         'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'VALENTINA OROZCO',                'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'YULIETH PACHECO',                 'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'ISABELLA SOFIA RUEDA CASERTA',    'OMEGA',   140, 700000,  168, 1008000, 196, 1372000, 'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'MARISELLA VIZCAINO',              'BETA',    120, 600000, NULL, NULL,    NULL, NULL,   'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'KARINA YISELL MARQUEZ HERNANDEZ', 'BETA',    120, 600000, NULL, NULL,    NULL, NULL,   'ACTAS ASESORES AGOSTO 2026.pdf'),
    ('2026-08-01', 'SANTIAGO ELI CHAVEZ CARMONA',     'NOVEDAD', 100, 500000, NULL, NULL,    NULL, NULL,   'ACTAS ASESORES AGOSTO 2026.pdf')
ON CONFLICT (periodo, asesor_norm) DO NOTHING;
