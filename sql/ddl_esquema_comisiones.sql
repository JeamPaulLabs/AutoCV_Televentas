-- Reglas del esquema de comisiones / otrosí por periodo (como_vamos_televentas).
-- Un otrosí nuevo se carga con un INSERT: no requiere cambios de código.
-- PENDIENTE de ejecutar en DataCenter_Vanti.

CREATE TABLE IF NOT EXISTS como_vamos_televentas.esquema_comisiones (
    periodo                      DATE PRIMARY KEY,      -- primer día del mes
    otrosi_activo                BOOLEAN NOT NULL DEFAULT TRUE,
    documento                    TEXT NOT NULL,
    fecha_documento              DATE,
    meta_equipo_altas_positivas  INTEGER NOT NULL,
    pct_minimo_comision          NUMERIC(4, 3) NOT NULL, -- 0.800 = 80%
    reglas                       JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{"titulo","texto"}]
    creado_en                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO como_vamos_televentas.esquema_comisiones
    (periodo, otrosi_activo, documento, fecha_documento,
     meta_equipo_altas_positivas, pct_minimo_comision, reglas)
VALUES (
    '2026-09-01', TRUE, 'Otrosí, esquema de comisión septiembre 2026', '2026-09-21',
    2000, 0.800,
    $json$[
      {"titulo": "Condición especial de comisionamiento",
       "texto": "En septiembre de 2026 se habilita el pago de comisión desde el 80% de cumplimiento de la meta individual de cada cargo, siempre que el equipo de Televentas alcance mínimo 2.000 altas positivas en el periodo. Esa condición es una medición general del equipo, no individual."},
      {"titulo": "Definición de altas positivas",
       "texto": "Las 2.000 altas se calculan sobre el total de ventas positivas del equipo en septiembre, sin importar el producto ni la meta individual. No aplica el requisito de las 25 ventas de productos voluntarios por asesor."},
      {"titulo": "Alcance",
       "texto": "Cumplida la condición de 2.000 altas, cada integrante accede a la comisión según su porcentaje individual de cumplimiento, desde el 80% de su meta y conforme al esquema de su cargo. El 80% se mide de forma individual; las 2.000 altas, para todo el equipo."},
      {"titulo": "Si el equipo no llega a 2.000",
       "texto": "Si al cierre de septiembre el equipo no alcanza las 2.000 altas positivas, el otrosí no aplica y la liquidación se hace con el esquema de comisiones principal, incluidos sus porcentajes mínimos y demás requisitos."},
      {"titulo": "Vigencia",
       "texto": "Aplica únicamente a la liquidación de septiembre de 2026. Desde el mes siguiente rige el esquema principal, salvo modificación formal posterior. Las demás condiciones del esquema principal se mantienen vigentes."},
      {"titulo": "Cancelaciones por fluctuación de audio",
       "texto": "Las ventas canceladas por fluctuaciones o fallas de audio atribuibles a la operación se reconocen y pagan al asesor, siempre que se valide que la venta fue efectivamente gestionada y que la cancelación obedeció a esa novedad técnica. También cuentan en la ejecución del asesor y en el resultado del equipo."}
    ]$json$::jsonb
)
ON CONFLICT (periodo) DO NOTHING;
