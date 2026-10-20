# Cambio: Rueda Seguro (RS) entra al acumulado del asesor

Fecha de la sesión: 20 de octubre de 2026.

## Pedido original

1. "A Konny y a Breiner se les debe contar lo que hagan en billetera" (ya cubierto
   por el cambio anterior de Billetera Protegida).
2. Konny veía solo 5 de billetera en su acumulado; **también deben contar sus
   ventas de RS**. "A Camila y a Gustavo también les cuentan RS."
3. La pantalla personal **no debe estar dividida**: un solo bloque de "Pólizas por
   estado" y "Día a día", con la etiqueta del producto (Cuota Protegida / Rueda
   Seguro / Billetera) en cada fila, "para los que les compete".
4. Aplica al reporte HTML estático que genera `main.py` (heredado por concatenar
   en `leer_televentas()`).

## Decisión de diseño

RS entra al **mismo pipeline que CP y BP** (concatenación en la rama en vivo de
`leer_televentas()`), así que lo heredan proyección/meta, tablas del equipo,
otrosí, caché `ventas_mes_actual`, snapshot `cierre_mensual` y reporte HTML. Se
revierte la regla anterior ("RS se reporta aparte y nunca se suma", validación RS
agosto 2026).

Cambios:
- `src/ilio_repo.py`: `PRODUCTO_RUEDA`, `es_rueda_seguro(df)`, concatenación de
  `leer_rueda_segura()` en `leer_televentas()`; `leer_rueda_segura()` ahora aplica
  `_ultimo_estado_por_contrato` (sept 2026: 119 filas crudas -> 117 contratos) para
  no contar dos veces una venta que avanzó de estado.
- `src/comisiones.py`: docstring (RS ya vive en el df consolidado).
- `backend/app/routers/como_vamos.py`: otrosí recibe `df_ventas` sin filas RS +
  `df_rs_ilio` (evita doble conteo); la vista personal ya no arma `rueda_segura`
  aparte — RS viene en `detalle_dia_dia`.
- `frontend/src/components/MiResumenAsesor.jsx`: un solo bloque `SeccionVentas`
  unificado, con chips de producto (CP/RS/BP) por día y filtro por producto; tarjeta
  "Rueda Seguro" cuando el asesor la tiene.
- `frontend/src/App.jsx`: pie de página actualizado; `ruedaSegura` ya no se pasa.
- `src/reporte_html.py`, `src/pivote.py`: notas y sección de auditoría RS (sin
  "no suma al acumulado").

## Datos verificados (BD DataCenter_Vanti, 2026-10-20)

- Konny Jorlano Argumedo: meta 50, acumulado **50** (45 RS + 5 BP) → 100 %.
- Breiner Steven Cataño: meta 50, acumulado **33** (31 RS + 2 BP) → 66 %.
- Camila Andrea Cuello: meta 100, acumulado **39** (26 CP + 13 BP + 2 RS → 39 %).
- Gustavo Andrés Herrera: acumulado incluye sus 2 RS.
- Septiembre: Konny 65 (RS), Breiner 52 (RS); otrosí 2.212 altas / 2.000
  (110,6 %) — sin doble conteo.
- Octubre: 1.067 ventas en el pipeline (651 CP V + 306 combo vida + 30 BP + 80 RS).
- `npm run build` OK; `python main.py --periodo 2026-10` genera el HTML con la
  sección BP y la de auditoría RS; endpoint `/api/como-vamos/dashboard` devuelve
  200 para Konny (50), Breiner (33), Camila (39), Israel (5, sept), Konny (65,
  sept) y supervisión (1.067 ventas, 4 asesores en `rueda_segura.tabla_asesor`).

## Hallazgos al margen

- `planes_sin_tarifa` ahora incluye también `RUEDA PLAN 1 SBS` (BP y RS quedan en
  $0 con aviso; la tarifa 17.313 de Ilio es del cliente, no se usa).
- `npm run lint` sigue sin correr (falta `eslint.config.js`) — estado previo.
- Agosto: Konny y Breiner no tienen meta cargada; sus RS (21 y 22) ahora aparecen
  en el pipeline y pueden salir en el aviso "Sin meta cargada" en el reporte de
  agosto (comportamiento consistente con el resto).
