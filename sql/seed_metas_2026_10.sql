-- Metas Octubre 2026 -- Socializacion meta octubre 2026 (Xuma, Barranquilla 01-oct-2026).
-- Solo 2 escalas (sin escala 3). Categoria tal cual el acta; RS = Rueda Seguro (hoja aparte).
INSERT INTO como_vamos_televentas.metas
    (periodo, asesor, categoria, meta_escala_1, base_pago_escala_1,
     meta_escala_2, base_pago_escala_2, meta_escala_3, base_pago_escala_3, fuente)
VALUES
    ('2026-10-01', 'ANDERSON MONTERROSA CASTILLA', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'DAYANA D GUERRERO HERNANDEZ', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'JEAN J GUZMAN', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'JESUS DAVID CORTES ORTEGA', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'JOELIS J BARROS B', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'LAURA L HERRERA PALOMINO', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'MELISSA PAOLA OROZCO JINETE', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'NOHELIA H SALAS MONTERROSA', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'RHOYMAR HERNANDEZ ALBARRAN', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'SANTIAGO ELI CHAVEZ CARMONA', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'MARISELLA VIZCAINO GUTIERREZ', 'ALFA', 110, 550000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'CESAR BARRERA PAJARO', 'BETA', 100, 500000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'ISABELLA SOFIA RUEDA CASERTA', 'BETA', 100, 500000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'KARINA YISELL MARQUEZ HERNANDEZ', 'BETA', 100, 500000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'VALENTINA OROZCO', 'BETA', 100, 500000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'GUILLERMO DE JESUS GONZALEZ', 'BETA', 100, 500000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'CAMILA ANDREA CUELLO MORAN', 'BETA', 100, 500000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'GUSTAVO ANDRES HERRERA ESTRADA', 'BETA', 100, 500000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'BREINER BARRERA RUDAS', 'BETA', 100, 500000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'ALAN JOSE HERNANDEZ LOAIZA', 'VACACIONES', 31, 155000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'LUISA L PERCY JARABA', 'VACACIONES', 60, 300000, 140, 840000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'JESUS CAMPO', 'NUEVO INGRESO', 10, 50000, NULL, NULL, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'BREINER STEVEN CATANO SALAZAR', 'RS', 50, 250000, 80, 480000, NULL, NULL, 'Socializacion meta octubre 2026.pdf'),
    ('2026-10-01', 'KONNY JORLANO ARGUMEDO PACHECO', 'RS', 50, 250000, 80, 480000, NULL, NULL, 'Socializacion meta octubre 2026.pdf')
ON CONFLICT (periodo, asesor_norm) DO NOTHING;
