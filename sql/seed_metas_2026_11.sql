-- Seed: metas Noviembre 2026 -- "Socializacion meta noviembre 2026" (Xuma,
-- Barranquilla 06-nov-2026, campana Seguros Vanti).
INSERT INTO como_vamos_televentas.metas
    (periodo, asesor, categoria, meta_escala_1, base_pago_escala_1,
     meta_escala_2, base_pago_escala_2, meta_escala_3, base_pago_escala_3, fuente)
VALUES
    ('2026-11-01', 'ALAN JOSE HERNANDEZ LOAIZA',      'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'ANDERSON MONTERROSA CASTILLA',    'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'DAYANA D GUERRERO HERNANDEZ',     'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'JEAN J GUZMAN',                   'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'LAURA L HERRERA PALOMINO',        'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'MELISSA PAOLA OROZCO JINETE',     'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'NOHELIA H SALAS MONTERROSA',      'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'SANTIAGO ELI CHAVEZ CARMONA',     'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'CAMILA ANDREA CUELLO MORAN',      'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'MARISELLA VIZCAINO GUTIERREZ',    'ALFA',           135, 675000,  162, 972000, 189, 1323000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'CESAR BARRERA PAJARO',            'BETA',           130, 650000,  156, 936000, 182, 1274000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'ISABELLA SOFIA RUEDA CASERTA',    'BETA',           130, 650000,  156, 936000, 182, 1274000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'KARINA YISELL MARQUEZ HERNANDEZ', 'BETA',           130, 650000,  156, 936000, 182, 1274000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'VALENTINA OROZCO',                'BETA',           130, 650000,  156, 936000, 182, 1274000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'GUILLERMO DE JESUS GONZALEZ',     'BETA',           130, 650000,  156, 936000, 182, 1274000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'GUSTAVO ANDRES HERRERA ESTRADA',  'BETA',           130, 650000,  156, 936000, 182, 1274000, 'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'JOELIS J BARROS B',                'LICENCIA',       100, 500000, NULL, NULL,   NULL, NULL,   'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'RHOYMAR HERNANDEZ ALBARRAN',       'RECESO LABORAL', 66,  330000, NULL, NULL,   NULL, NULL,   'Socializacion meta noviembre 2026'),  -- ajuste por licencia: 66 ventas (acta traia 95)
    ('2026-11-01', 'LUISA L PERCY JARABA',             'VACACIONES',     60,  300000, NULL, NULL,   NULL, NULL,   'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'JESUS DAVID CORTES ORTEGA',        'VACACIONES',     50,  250000, NULL, NULL,   NULL, NULL,   'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'JESUS ADRIAN CAMPO ALVAREZ',        'NUEVO INGRESO',  60,  300000, NULL, NULL,   NULL, NULL,   'Socializacion meta noviembre 2026'),  -- "JESUS CAMPO" en el acta
    ('2026-11-01', 'CAMILA MARTINEZ DE ALBA',           'NUEVO INGRESO',  60,  300000, NULL, NULL,   NULL, NULL,   'Socializacion meta noviembre 2026'),  -- "CAMILA MARTINEZ" en el acta
    ('2026-11-01', 'CESAR DE LOS REYES',               'NUEVO INGRESO',  40,  200000, NULL, NULL,   NULL, NULL,   'Socializacion meta noviembre 2026'),
    ('2026-11-01', 'JULYSA PAOLA SILVERA TRUYOL',       'NUEVO INGRESO',  40,  200000, NULL, NULL,   NULL, NULL,   'Socializacion meta noviembre 2026'),  -- "JULYSA SILVERO" en el acta
    ('2026-11-01', 'BREINER STEVEN CATANO SALAZAR',     'BILLETERA PROTEGIDA', 80, 400000, 96, 576000, 112, 784000, 'Socializacion meta noviembre 2026 (Breiner y Konny)'),
    ('2026-11-01', 'KONNY JORLANO ARGUMEDO PACHECO',    'BILLETERA PROTEGIDA', 80, 400000, 96, 576000, 112, 784000, 'Socializacion meta noviembre 2026 (Breiner y Konny)')
ON CONFLICT (periodo, asesor_norm) DO UPDATE SET
    categoria = EXCLUDED.categoria,
    meta_escala_1 = EXCLUDED.meta_escala_1, base_pago_escala_1 = EXCLUDED.base_pago_escala_1,
    meta_escala_2 = EXCLUDED.meta_escala_2, base_pago_escala_2 = EXCLUDED.base_pago_escala_2,
    meta_escala_3 = EXCLUDED.meta_escala_3, base_pago_escala_3 = EXCLUDED.base_pago_escala_3,
    fuente = EXCLUDED.fuente;
