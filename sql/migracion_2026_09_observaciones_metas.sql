-- Otrosí sept 2026: observaciones por asesor y ajuste de meta de Santiago Eli
-- Chavez Carmona (5 días de incapacidad por fallecimiento de familiar).
-- Escala 2 = 107 x 1.2, escala 3 = 107 x 1.4; bases de pago sin cambio.
-- PENDIENTE de ejecutar en DataCenter_Vanti.
ALTER TABLE como_vamos_televentas.metas ADD COLUMN IF NOT EXISTS observaciones TEXT;

UPDATE como_vamos_televentas.metas
SET meta_escala_1 = 107, meta_escala_2 = 128, meta_escala_3 = 150,
    observaciones = 'Meta ajustada a 107 por 5 días de incapacidad (fallecimiento de familiar)'
WHERE periodo = '2026-09-01' AND asesor_norm = 'SANTIAGO ELI CHAVEZ CARMONA';
