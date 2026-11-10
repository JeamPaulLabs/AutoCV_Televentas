# Análisis de auditoría por criterios del guion (pestaña "Mi auditoría")

Sesión: 10 de noviembre de 2026. Implementado y probado contra octubre (362
canceladas revisadas, 23 asesores).

## Qué es

Análisis agregado de TODAS las canceladas revisadas del mes
(`como_vamos_televentas.canceladas_revision` — incluye las que luego se
subsanaron: se analiza el audio auditado, no el estado actual de la venta),
clasificadas contra los criterios de auditoría de
`context/02_criterios_auditoria/03_parametros_auditoria.md`.

- **Asesor** (vista personal): pestaña "Mi auditoría" junto a "Mi operación".
  Ve solo lo suyo, agregado y en tono de mejora (dónde se concentraron sus
  hallazgos, qué aspectos de gestión corregir, qué criterios tiene limpios).
  Nunca caso a caso.
- **Martha / Kevin** (vista equipo): pestaña "Análisis auditoría" con KPIs del
  mes, criterios y aspectos del equipo, y detalle expandible por asesor con la
  misma retroalimentación que ve cada uno.
- La pestaña queda **inactiva** en los meses sin revisión cargada (noviembre
  se activa solo cuando auditoría cargue su Excel con `cargar_canceladas`).

## Cómo clasifica

`backend/app/analisis_criterios.py`: clasificador por reglas (regex sobre el
texto normalizado de `causal_gestion` + observaciones). No inventa nada; solo
ubica cada hallazgo del auditor en:

- **10 criterios del guion** (presentación, responsabilidad de pago, producto,
  frase de negociación, pregunta de validación, validación de datos, habeas
  data, cláusula de cobro, información final, cierre) + cargue en ILIO.
- **Aspectos de gestión** (lo que el asesor controla): respuestas no válidas
  aceptadas, información errada/omitida, trato al usuario, titular sin
  confirmar, cargue ILIO.
- **Falla técnica de audio** (fluctuación/ruido/no audible): se cuenta aparte
  — afecta la venta pero no es incumplimiento del asesor (otrosí la reconoce).
- **Administrativas** (EXCEDE, carga doble): fuera del análisis de calidad.

Validado contra octubre: 362/362 filas clasificadas (0 sin clasificar).

## Piezas

- Backend: `backend/app/analisis_criterios.py` (clasificador + resumen por
  asesor), `backend/app/routers/analisis_canceladas.py`
  (GET `/api/como-vamos/analisis-canceladas?periodo=YYYY-MM`; el rol decide la
  vista: `roles_auditoria` → equipo, resto → personal vía `asesor_alias`).
- Frontend: `MiAnalisisAuditoria.jsx` (asesor),
  `admin/AnalisisEquipoAuditoria.jsx` (equipo), pestañas en `App.jsx` y
  `VistaEquipo.jsx`, servicio en `services/comoVamos.js`, overrides de
  contraste tema claro para tonos sky/amber en `index.css`.

## Cumplimiento porcentual por producto (agregado en la misma sesión)

Además del análisis de hallazgos, cada vista muestra **% de cumplimiento del
guion por producto y por criterio**:

- **Premisa definida por el dueño del proceso**: toda venta del mes pasa por
  auditoría; la que quedó en alta/auditada sin cancelación cumplió todos los
  criterios. Denominador = total de ventas del producto en el mes
  (`leer_televentas`, respeta cierres de mes y exclusiones); fallas = canceladas
  revisadas con hallazgo de gestión en ese criterio.
- Las **fallas técnicas de audio no restan** en el porcentaje (no son
  incumplimiento del asesor); se informan aparte ("solo audio").
- Solo **Cuota Protegida y Plan Combo Vida** tienen guion cargado; Billetera
  Protegida y Rueda Seguro salen como "guion pendiente de cargar" hasta tenerlo.
- Los asesores **sin canceladas revisadas** también aparecen en la vista de
  equipo (✓ 100% en sus productos) — que les fue bien también se ve.
- Octubre (validación): CP 93,3% global (1.084 ventas, 231 revisadas),
  PCV 93,3% (432 ventas, 76 revisadas); BP 21 y RS 34 revisadas pendientes.
- Piezas: `cumplimiento_productos()` y `producto_corto()` en
  `analisis_criterios.py`; `_ventas_por_asesor()` en el router;
  `CumplimientoProductos.jsx` compartido entre la vista personal y la de equipo.

## Pendiente

- Revisión visual en navegador con sesión real (ambos temas, móvil) antes de
  desplegar — el build de Vite pasa y el API respondió 200 en los 4 casos
  (auditor/asesor × octubre/noviembre) con JWT real.
- Si el estilo de redacción de los auditores cambia, revisar los patrones del
  clasificador con el script de validación (muestrear filas `sin_clasificar`).
