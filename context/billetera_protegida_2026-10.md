# Cambio: Billetera Protegida (BP) entra al tablero y cuenta con la meta

Fecha de la sesión: 20 de octubre de 2026.

## Pedido original

1. Que los asesores vean sus gestiones de **Billetera Protegida (BP)** en su pantalla personal, tanto como cuenta del día a día como en el tablero del equipo.
2. Que BP **tenga en cuenta la meta** del asesor (acumulado, forecast, semáforo, podio y escala).
3. Que las altas positivas de BP **sí sumen** a la condición de equipo del otrosí (hoy: CP + RS).
4. Que aplique también al **reporte HTML estático** que genera `main.py`.
5. Confirmación del usuario: "Konny y Breiner se les debe contar lo que hagan en billetera" y "la meta de Camila es de 100".

## Decisión de diseño

BP se **concatena al pipeline principal de ventas** en la rama en vivo de `leer_televentas()`, en un solo punto. Así todo lo que cuelga de esa función lo hereda sin duplicar lógica: proyección y meta, tablas del equipo, otrosí, caché `ventas_mes_actual`, snapshot `cierre_mensual` y reporte HTML.

| Producto | ¿Cuenta en la meta del asesor? | ¿Suma al otrosí? | Fuente |
|----------|-------------------------------|-------------------|--------|
| Cuota Protegida (CP) | Sí | Sí | `ilio.v_cuota_protegida` |
| **Billetera Protegida (BP)** | **Sí** (decisión 2026-10-20) | **Sí** | `ilio.v_billetera_protegida` |
| Rueda Seguro (RS) | No (se reporta aparte) | Sí (se pasa aparte al otrosí) | `ilio.v_rueda_segura` |

**Señal durable para identificar BP**: la columna `producto` normalizada es exactamente `BILLETERA PROTEGIDA` (constante `PRODUCTO_BILLETERA` + helper `es_billetera(df)` en `src/ilio_repo.py`). Se eligió `producto` —y no la tabla de origen— porque es la señal que **también sobrevive al snapshot de meses cerrados** (`cierre_mensual` y `ventas_mes_actual` ya tienen la columna `producto`).

## Cambios por archivo

| Archivo | Cambio |
|---------|--------|
| `src/ilio_repo.py` | Constante `PRODUCTO_BILLETERA`, helper `es_billetera(df)`, nueva `leer_billetera_protegida(periodo, fecha_corte)` (mismos filtros que CP: estrategia Televentas, supervisor `SUPERVISOR  TMK 1`, colectivo mensual o anual, sin `RENOVACION`, último estado por contrato) y la concatenación dentro de `leer_televentas()`. |
| `src/pivote.py` | Núcleo de conteo compartido `_conteo_por_dia` / `_conteo_por_asesor` (antes inline en las funciones de RS) + `resumen_bp_por_dia` / `resumen_bp_por_asesor`. Sin facturación: la Facturación SERVI de BP es $0. |
| `src/comisiones.py` | Docstring de `estado_otrosi` (BP ya cuenta sola porque viene dentro del df). **Sin cambio de lógica.** |
| `backend/app/routers/como_vamos.py` | Sección `billetera` (`tabla_dias`, `tabla_asesor`) en la vista equipo; tarjeta `billetera` (`total`, `altas`) en la vista personal. |
| `frontend/src/App.jsx` | Bloque "Billetera Protegida — cuenta en el acumulado" en el tablero del equipo (junto al de RS); pasa `billetera` a la pantalla personal; pie de página actualizado. |
| `frontend/src/components/MiResumenAsesor.jsx` | **Refactor simétrico** (ver abajo). |
| `src/reporte_html.py` | Sección "Billetera Protegida — sí cuenta en el acumulado (BP)" en las pestañas "Resumen" y "Vanti"; nota en RS y en el pie de página. La maqueta `grid-2` original se conservó: RS y BP son secciones paralelas, no columnas nuevas. |

### El refactor de la pantalla personal (regresión evitada de RS)

**Qué estaba frágil:** el componente tenía un modo `soloRS` que se activaba cuando el asesor "no tenía ventas de CP". Al meter BP al pipeline, Konny dejó de estar en ese modo y habría **perdido el detalle de sus 44 Rueda Seguro** (estados y día a día).

**Qué se hizo:** dos bloques simétricos, cada uno con su propio componente `SeccionProducto` (con su propio filtro por estado y su propio popup):

1. **Cuota Protegida + Billetera Protegida**: meta, categoría, acumulado, forecast, barra de cumplimiento, "Pólizas por estado" y "Día a día".
2. **Rueda Seguro**: tarjeta de total y altas, "Pólizas por estado" y "Día a día".

El modo "solo RS" (asesor sin ventas de CP/BP) queda cubierto por el mismo mecanismo: si `detalle` está vacío, simplemente no se renderiza el bloque 1 y solo aparece RS. Se eliminó `soloRS` como concepto.

Nuevo: la tarjeta "Billetera Protegida" (total del mes y altas) aparece junto a las tiles de meta cuando el asesor la tiene.

## Facturación SERVI de BP

`con_facturacion_servi` deja BP en **$0** porque `PLAN A` no tiene tarifa cargada en `como_vamos_televentas.tarifas_planes`, y así se decidió: el aviso `AVISO: planes vendidos sin tarifa/comisión SERVI ... - PLAN A` lo confirma. **No usar** la tarifa de 17.313 que aparece en Ilio: es la tarifa *del cliente*, no la comisión de SERVI.

## Datos verificados (BD `DataCenter_Vanti`, 2026-10-20)

- Vista `ilio.v_billetera_protegida`: 50 filas Televentas / supervisor `SUPERVISOR  TMK 1`; colectivos `SEPTIEMBRE 2026` (19) y `OCTUBRE 2026` (31); producto único `BILLETERA PROTEGIDA` / `PLAN A`; estados ALTA TRANSACCIONAL 32, CANCELADA 9, DIGITADA WEB 8, AUDITADA WEB 1.
- **No hay ningún mes cerrado** en `como_vamos_televentas.cierres_mes`, así que todo se lee en vivo.
- Metas de octubre 2026: Konny 50 (cat RS), **Breiner Steven Cataño Salazar 50** (cat RS, "la misma meta de Konny"), **Camila Andrea Cuello Moran 100** (cat BETA) — **ya estaban cargadas**, no hubo que insertar nada (mi primera consulta había fallado por no normalizar la Ñ y los dobles espacios).

### Resultado tras el cambio (octubre 2026, 2026-10-20)

| Asesor | Meta | Acumulado antes | Acumulado ahora | Detalle |
|--------|-----:|----------------:|----------------:|---------|
| Konny Jorlano Argumedo | 50 | 0 | **5** | 5 BP (3 altas, 2 canceladas) + 44 RS aparte |
| Breiner Steven Cataño | 50 | 0 / "SIN META" | **2** | 2 BP (1 alta, 1 cancelada) + 30 RS aparte |
| Camila Andrea Cuello | 100 | 22 | **35** | 22 CP + 13 BP |

- Octubre: CP 943 + BP 30 = 973 (luego 976, datos en vivo) ventas en el pipeline.
- Septiembre: CP 2192 + BP 19. Otrosí: 2.126 altas positivas / 2.000 (106,3 %), de las cuales **19 son de BP** (sin BP habría sido 2.107: el resultado no cambia, pero BP sí queda contada).

### Pruebas ejecutadas

- `python main.py --periodo 2026-10` → genera el HTML con la sección BP en ambas pestañas y el aviso de `PLAN A`.
- Script del pipeline (mismo camino que `main.py`) → números de la tabla anterior.
- Endpoint `/api/como-vamos/dashboard` con JWT simulado (mismo `JWT_SECRET` del portal):
  - sin sesión → **401**, usuario sin alias → **403** (comportamiento intacto);
  - Konny, Breiner, Camila e Israel → **200** con `billetera`, `detalle_dia_dia` incluyendo BP y `rueda_segura` completo;
  - supervisión → **200** con `billetera.tabla_asesor` (10 asesores) y `tabla_producto` con `BILLETERA PROTEGIDA`.
- `npm run build` en `frontend/` → OK.

## Hallazgos al margen (no son de este cambio)

- **No existe esquema de comisiones para 2026-10** (`como_vamos_televentas.esquema_comisiones` solo tiene `2026-09-01`, y el YAML `config/esquema_comisiones.yml` igual). Por eso el tarro del otrosí sale `null` en octubre en el tablero. Hay que cargarlo cuando esté el otrosí del mes.
- **`npm run lint` no corre en `frontend/`**: el `package.json` define el script pero **no existe `eslint.config.js`** (ni `.eslintrc.*`). Es un estado previo, no de este cambio.
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `docs/`, `Comparativo_Karina_Agosto2026.xlsx` y varios `context/*.md` siguen **sin commit** (trabajo previo de otras sesiones, no tocado).

## Pendiente

- [ ] Commit de los 7 archivos de código + este documento.
- [ ] **Redeploy en Coolify** (no requiere variables nuevas ni migraciones).
- [ ] Después del deploy, `Ctrl+Shift+R` en las PCs que ya usan la app.
- [ ] Verificar en producción: Konny ve tarjeta "Billetera Protegida 5" + sus 44 RS; Breiner ve 2; Camila ve 35 de meta 100; el tablero muestra la sección BP.
- [ ] Cargar el esquema de comisiones de octubre 2026 cuando salga el otrosí.
- [ ] Cargar `PLAN A` en `como_vamos_televentas.tarifas_planes` **sí** se decide cobrarle comisión SERVI a BP (hoy queda $0 con aviso, por decisión).
