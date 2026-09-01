-- Tarifas y comisión SERVI por plan de Televentas -- fuente:
-- context/TARIFAS DE PLANES.xlsx (hoja TARIFAS PRODUCTOS, filtrado estrategia=Televentas).
-- Se usa para calcular la columna "Facturación SERVI" del dashboard
-- (Facturación SERVI de una póliza = comision_servi del plan vendido).

CREATE TABLE IF NOT EXISTS como_vamos_televentas.tarifas_planes (
    id              BIGSERIAL PRIMARY KEY,
    plan            VARCHAR NOT NULL,
    plan_norm       TEXT GENERATED ALWAYS AS (upper(trim(regexp_replace(plan, '\s+', ' ', 'g')))) STORED,
    tarifa          NUMERIC(14, 2) NOT NULL,
    comision_servi  NUMERIC(14, 2) NOT NULL,
    fuente          TEXT DEFAULT 'TARIFAS DE PLANES.xlsx',
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (plan_norm)
);

INSERT INTO como_vamos_televentas.tarifas_planes (plan, tarifa, comision_servi) VALUES
    ('ADELANTA POR ENFERMEDADES GRAVES PLAN 2', 13990, 27028.68),
    ('ASISTENCIA TELEMEDICINA + ODONTOLOGIA + MASCOTAS PLAN 1', 12200, 23570.40),
    ('PLAN 1 CUOTA PROTEGIDA', 14000, 36120.00),
    ('PLAN 2 CUOTA PROTEGIDA', 28000, 51240.00),
    ('RENTA DIARIA POR HOSPITALIZACION ASISTENCIA ZURICH PLAN 1', 12200, 23570.40),
    ('VIDA 4 ZURICH PLAN 2', 13990, 27028.68),
    ('VIDA ZURICH PLAN 1', 12500, 24150.00),
    ('VIDA ZURICH PLAN 2', 16200, 31298.40),
    ('ADELANTA POR ENFERMEDADES GRAVES PLAN 3', 17990, 34756.68),
    ('COBERTURA VIDA 3 PLAN 1', 23900, 46174.80),
    ('COBERTURA VIDA 3 PLAN 4', 31990, 61804.68),
    ('COBERTURA VIDA 3 PLAN 2', 25990, 50212.68),
    ('COBERTURA VIDA 3 PLAN 3', 29990, 57940.68),
    ('ASISTENCIA MEDICA Y ODONTOLOGICA 3 PLAN 1', 23900, 46174.80),
    ('COBERTURA RENTA DIARIA POR HOSPITALIZACION 3 PLAN 4', 31990, 61804.68),
    ('COBERTURA RENTA DIARIA POR HOSPITALIZACION 3 PLAN 1', 23900, 46174.80),
    ('RENTAN DIARIA POR HOSPITALIZACION ZURICH PLAN 1', 12500, 24150.00),
    ('CUOTA PROTEGIDA SILVER 1', 20000, 38640.00)
ON CONFLICT (plan_norm) DO NOTHING;
