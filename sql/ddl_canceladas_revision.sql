-- Tabla con la revisión (subsanación / re-auditoría) de las ventas canceladas,
-- cargada desde "REPORTE CANCELADAS 2026 CMK VANTI.xlsx" (hojas TMK / SUB TMK).
-- Cruce: pantalla personal del asesor, por (periodo, numero_contrato).
--
-- No se guardan datos personales del asegurado (documento, nombre, teléfono).
-- Solo campos operativos de la cancelación y su revisión.

CREATE TABLE IF NOT EXISTS como_vamos_televentas.canceladas_revision (
    periodo                    date NOT NULL,
    numero_contrato            text NOT NULL,
    asesor                    text,
    producto                  text,
    fecha_venta               date,
    causal_gestion             text,   -- motivo de cancelación (CAUSAL DE GESTION)
    gestion_supervisor_tmk    text,   -- estado de subsanación (GESTIÓN SUPERVISOR TMK)
    observacion                text,   -- observación de Kevin
    resultado_re_auditoria    text,   -- RESULTADO DE RE AUDITORIA Y SUBSANACION
    observacion_re_auditoria  text,   -- OBSERVACION RE AUDITORIA Y SUBSANACION
    estado_subsanacion         text,   -- ESTADO DE SUBSANACION (hoja SUB TMK)
    solicitud                 text,
    reauditoria               text,   -- REAUDITORIA Y SUBSANACION
    observaciones_reauditoria text,   -- OBSERVACIONES (hoja SUB TMK)
    fecha_gestion             date,
    gestor                    text,
    tiempo_subs_1             text,
    tiempo_subs_2             text,
    actualizado_en            timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (periodo, numero_contrato)
);

CREATE INDEX IF NOT EXISTS ix_canceladas_revision_periodo
    ON como_vamos_televentas.canceladas_revision (periodo);

CREATE INDEX IF NOT EXISTS ix_canceladas_revision_asesor
    ON como_vamos_televentas.canceladas_revision (asesor);