-- Tabla espejo del periodo en curso (o del último periodo procesado que aún no
-- ha sido cerrado por auditoría). Se recalcula por completo (DELETE + INSERT)
-- en cada corrida de main.py, con facturacion_servi ya calculada -- sirve para
-- poder consultar "cómo va agosto" en SQL sin tener que volver a leer Ilio ni
-- recalcular la tarifa por plan.
--
-- No reemplaza el cierre formal (cierre_mensual): esto es un caché de trabajo
-- del mes abierto, se sobreescribe en cada corte. El historial oficial sigue
-- siendo cierre_mensual, que solo se llena cuando auditoría declara el cierre.

CREATE TABLE IF NOT EXISTS como_vamos_televentas.ventas_mes_actual (
    periodo             date NOT NULL,
    id_poliza           bigint NOT NULL,
    fecha_venta         date,
    fecha_digitacion    date,
    asesor              text,
    supervisor          text,
    estrategia          text,
    producto            text,
    plan                text,
    colectivo           text,
    entidad_facturacion text,
    tarifa              numeric,
    nombre_estado       text,
    facturacion_servi   numeric NOT NULL DEFAULT 0,
    actualizado_en      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (periodo, id_poliza)
);

CREATE INDEX IF NOT EXISTS ix_ventas_mes_actual_periodo
    ON como_vamos_televentas.ventas_mes_actual (periodo);
