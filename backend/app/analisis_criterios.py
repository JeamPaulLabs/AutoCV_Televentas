"""Análisis de las canceladas revisadas contra los criterios de auditoría.

Clasifica el texto libre que escribe auditoría interna (Kevin / posventa) en
cada cancelada (causal_gestion + observaciones) contra los criterios del
proceso de calidad (context/02_criterios_auditoria/03_parametros_auditoria.md)
y arma, por asesor, un resumen orientado a la mejora: en qué parte del guion
se concentran sus hallazgos, qué aspectos de gestión debe corregir y qué
criterios tiene limpios.

Es un clasificador por reglas (regex sobre texto normalizado): no inventa
nada, solo cuenta en qué tramo del guion el auditor ubicó cada hallazgo.
"""
from __future__ import annotations

import re
import unicodedata


def _norm(texto: str | None) -> str:
    t = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", t).lower().strip()


# ---------------------------------------------------------------------------
# Criterios del guion (dónde ocurrió el hallazgo). El orden es el del proceso.
# "recomendacion" está escrita PARA EL ASESOR, en tono de mejora.
# ---------------------------------------------------------------------------
CRITERIOS = [
    {
        "id": "presentacion",
        "nombre": "Presentación y saludo",
        "patron": r"saludo|se presenta|presentacion de la oferta|mencionar la aseguradora|al inicio de la llamada.{0,40}(zurich|presenta)",
        "recomendacion": "Al iniciar, da tu nombre completo, la aseguradora Zurich y la alianza con Vanti, sin modificar el saludo del guion.",
    },
    {
        "id": "responsabilidad_pago",
        "nombre": "Responsabilidad de pago",
        "patron": r"responsabilidad de pago|responsable (del|de el) (pago|credito)",
        "recomendacion": "Confirma de forma clara y pausada que hablas con la persona responsable del pago o del crédito antes de ofrecer; si la respuesta deja dudas, repite la pregunta.",
    },
    {
        "id": "presentacion_producto",
        "nombre": "Presentación del producto (coberturas y valores)",
        "patron": r"cobertura|indemnizacion|indeminizacion|incapacidad|telemedicina|teleconsulta|hospitalizacion|accidente|desempleo|renta (diaria|hospitalaria)|hurto|estafa|fallecer|beneficiarios",
        "recomendacion": "Menciona todas las coberturas con sus valores exactos y en orden, sin omitir ninguna; si el usuario confunde el producto, repite coberturas y valor.",
    },
    {
        "id": "frase_negociacion",
        "nombre": "Frase de negociación",
        "patron": r"frase de negociacion|ciclo de facturacion|valor (de la poliza|errado de la poliza)",
        "recomendacion": "La frase de negociación es textual y causal de rechazo: dila completa, pausada y con el valor en tono fuerte y claro, verificando el valor que corresponde a la edad del usuario.",
    },
    {
        "id": "pregunta_validacion",
        "nombre": "Pregunta de validación (¿todo claro?)",
        "patron": r"todo claro hasta el momento|pregunta de validacion|frase de validacion",
        "recomendacion": "Tras informar producto y valor pregunta \"¿está todo claro hasta el momento?\" y espera una respuesta positiva cerrada; si la respuesta no corresponde, repite la información antes de continuar.",
    },
    {
        "id": "validacion_datos",
        "nombre": "Validación de datos",
        "patron": r"validacion de (la )?(cedula|datos|los datos)|validar (la |los )?(datos|direccion|cedula|fecha)|fecha de nacimiento|fecha de expedicion|direccion|numero de contrato|contrato \d|cedula|correo electronico|anos? de edad",
        "recomendacion": "Valida nombre, cédula, fecha de nacimiento, dirección, contrato y correo contra lo que registra el sistema; si el usuario corrige un dato o duda, confírmalo con factura en mano antes de seguir.",
    },
    {
        "id": "habeas_data",
        "nombre": "Habeas Data",
        "patron": r"habeas data|zurichseguros|tratamiento de sus datos",
        "recomendacion": "El Habeas Data es textual y causal de rechazo: léelo completo y pausado, pronuncia bien ZURICH y la página web, y espera una respuesta abierta válida (SÍ / BUENO / DE ACUERDO / CORRECTO) sin inducirla.",
    },
    {
        "id": "clausula_cobro",
        "nombre": "Cláusula de cobro",
        "patron": r"clausula de cobro|frase de seguridad|autoriza a (vanti|gas)|acuerdo al ipc|cargar mensualmente",
        "recomendacion": "La cláusula de cobro es textual y causal de rechazo: no omitas palabras (p. ej. \"mensualmente\", \"IPC\", \"amparo\"), léela pausada y acepta solo respuestas cerradas sin condiciones; ante objeción, frase de seguridad o repetirla completa.",
    },
    {
        "id": "informacion_final",
        "nombre": "Información final (#723 y voluntariedad)",
        "patron": r"#\s?723|723\b|dias posteriores|proteccion es voluntaria|es voluntaria",
        "recomendacion": "Cierra siempre con los dos textos finales sin unir frases: el aviso del #723 dentro de los 10 días del evento y el recordatorio de que la protección es voluntaria.",
    },
    {
        "id": "cierre",
        "nombre": "Cierre y despedida",
        "patron": r"despedida|no hay cierre|finaliza la llamada|se finaliza la llamada|colgar|cierre de venta",
        "recomendacion": "Diferencia la despedida de la información final, mantén el trato cordial y no cuelgues sin dar espacio a que el usuario se despida.",
    },
]

# ---------------------------------------------------------------------------
# Aspectos de gestión (qué tipo de hallazgo fue). Pueden cruzarse con varios
# criterios; son lo que el asesor sí controla y debe corregir.
# ---------------------------------------------------------------------------
ASPECTOS = [
    {
        "id": "respuestas_no_validas",
        "nombre": "Respuestas del usuario no válidas aceptadas",
        "patron": r"modismo|condicionad|respuestas? (cerrada|validas|permitidas)|respuesta.{0,60}(no es clara|no se comprende|no va acorde|no es audible)|induce|inducir|no brindando una respuesta|no se evidencia una respuesta|respuesta positiva cerrada|mmjum|si como no",
        "recomendacion": "Solo valen respuestas cerradas (SÍ / BUENO / DE ACUERDO / CORRECTO): si el usuario responde con modismos, condiciones o algo que no se entiende, repite la pregunta hasta obtener una respuesta clara.",
    },
    {
        "id": "informacion_inexacta",
        "nombre": "Información errada, adicional u omitida",
        "patron": r"informacion (errada|erronea|adicional|incorrecta)|valor errado|no es correcta|informacion no es correcta|omite|omitir|no menciona|no indica la|no repite|debio (aclarar|indicar|dejar|complementar|hacer|repetir|retomar|consultar|validar|finalizar|convencer|recapitular)|modifica|no puede (agregar|dar) informacion|linea de atencion",
        "recomendacion": "Apóyate en el guion tal cual está escrito: no agregues, cambies ni omitas información (valores, condiciones de las coberturas, documentos); ante preguntas que no cubre el guion, remite a la línea de atención.",
    },
    {
        "id": "trato_usuario",
        "nombre": "Trato y escucha al usuario",
        "patron": r"interrump|tono de voz|alzar el tono|burla|acelerad|respetar la palabra|expresarse de forma libre|hablan al tiempo|prohibido el uso de .?.?mi|senor@|conversacion previa|dialogo con (companeros|otra)|no tiene relacion con la gestion|lenguaje inapropiado",
        "recomendacion": "Mantén un tono pausado y uniforme, no interrumpas al usuario mientras se expresa y usa el tratamiento permitido (señor/señora); ante retractos, convence con las coberturas, sin presionar.",
    },
    {
        "id": "titular_no_confirmado",
        "nombre": "Venta sin confirmar al titular",
        "patron": r"no es la (sra|sr|senora|senor)|persona del sexo|voz de (la persona|una? mujer|un hombre)|le pasa la llamada|titular una? (hombre|mujer)|registra el nombre de una? (hombre|mujer)|valida con un tercero|analfabeta",
        "recomendacion": "Verifica desde el saludo que hablas con el titular; si otra persona atiende o la llamada cambia de manos, retoma la venta desde la presentación.",
    },
    {
        "id": "cargue_ilio",
        "nombre": "Cargue correcto en ILIO",
        "patron": r"carga (en el )?aplicativo|aplicativo (nos )?registra|carga plan|cargue de venta|cargar venta nueva|carga.{0,40}poliza|carga la poliza|en ilio (nos )?registra",
        "recomendacion": "Carga en ILIO exactamente el plan y el valor que ofreciste en la llamada; si cargaste un producto o valor distinto, haz el cargue nuevo y cancela la póliza errónea.",
    },
]

# Falla técnica de audio: no es un incumplimiento de guion del asesor, pero
# afecta la calidad de la venta. Se cuenta aparte para que la retroalimentación
# no lo mezcle con los aspectos de gestión.
PATRON_AUDIO = re.compile(
    r"fluctuaci|flcutuacion|flutuacion|fluctua|ruido|intermiten|entrecortad|no (es|son) audible|queda en silencio|microfono|diadema",
)

# Hallazgos administrativos: no hablan de la calidad de la llamada.
PATRON_ADMIN = re.compile(r"^excede$|excede\b|carga doble|cargada dos veces|duplicid")

_CRITERIOS_RE = [(c, re.compile(c["patron"])) for c in CRITERIOS]
_ASPECTOS_RE = [(a, re.compile(a["patron"])) for a in ASPECTOS]


def texto_revision(fila: dict) -> str:
    """Une los campos de texto libre de una cancelada revisada."""
    partes = [
        fila.get("causal_gestion"),
        fila.get("observacion"),
        fila.get("observacion_re_auditoria"),
        fila.get("observaciones_reauditoria"),
    ]
    return " … ".join(p for p in partes if p)


def clasificar(fila: dict) -> dict:
    """Clasifica una cancelada: en qué criterios del guion cayó el hallazgo,
    qué aspectos de gestión señala y si hubo falla técnica de audio."""
    t = _norm(texto_revision(fila))
    if not t:
        return {"criterios": [], "aspectos": [], "audio": False, "administrativa": False, "sin_clasificar": True}
    if PATRON_ADMIN.search(t) and len(t) < 60:
        return {"criterios": [], "aspectos": [], "audio": False, "administrativa": True, "sin_clasificar": False}

    criterios = [c["id"] for c, rx in _CRITERIOS_RE if rx.search(t)]
    aspectos = [a["id"] for a, rx in _ASPECTOS_RE if rx.search(t)]
    audio = bool(PATRON_AUDIO.search(t))
    return {
        "criterios": criterios,
        "aspectos": aspectos,
        "audio": audio,
        "administrativa": False,
        "sin_clasificar": not criterios and not aspectos and not audio,
    }


def analizar_asesor(filas: list[dict]) -> dict:
    """Resumen de mejora de UN asesor a partir de sus canceladas revisadas."""
    por_criterio: dict[str, dict] = {}
    por_aspecto: dict[str, int] = {}
    audio_total = 0
    solo_audio = 0
    administrativas = 0
    sin_clasificar = 0

    for f in filas:
        r = clasificar(f)
        if r["administrativa"]:
            administrativas += 1
            continue
        if r["sin_clasificar"]:
            sin_clasificar += 1
            continue
        if r["audio"]:
            audio_total += 1
            if not r["aspectos"]:
                solo_audio += 1
        for cid in r["criterios"]:
            d = por_criterio.setdefault(cid, {"total": 0, "con_audio": 0, "con_gestion": 0})
            d["total"] += 1
            if r["audio"]:
                d["con_audio"] += 1
            if r["aspectos"]:
                d["con_gestion"] += 1
        for aid in r["aspectos"]:
            por_aspecto[aid] = por_aspecto.get(aid, 0) + 1

    nombres_c = {c["id"]: c for c in CRITERIOS}
    nombres_a = {a["id"]: a for a in ASPECTOS}

    criterios = sorted(
        (
            {"id": cid, "nombre": nombres_c[cid]["nombre"], **vals}
            for cid, vals in por_criterio.items()
        ),
        key=lambda x: -x["total"],
    )
    aspectos = sorted(
        ({"id": aid, "nombre": nombres_a[aid]["nombre"], "total": n} for aid, n in por_aspecto.items()),
        key=lambda x: -x["total"],
    )

    # Recomendaciones: primero los aspectos de gestión (lo que el asesor
    # controla), luego los criterios donde más se concentran sus hallazgos
    # NO explicados solo por audio.
    recomendaciones = [
        {"tema": nombres_a[a["id"]]["nombre"], "texto": nombres_a[a["id"]]["recomendacion"], "casos": a["total"]}
        for a in aspectos
    ]
    for c in criterios:
        if c["con_gestion"] > 0 or c["total"] > c["con_audio"]:
            recomendaciones.append({
                "tema": nombres_c[c["id"]]["nombre"],
                "texto": nombres_c[c["id"]]["recomendacion"],
                "casos": c["total"],
            })
    recomendaciones = recomendaciones[:6]

    con_hallazgo = {c["id"] for c in criterios}
    fortalezas = [c["nombre"] for c in CRITERIOS if c["id"] not in con_hallazgo]

    revisadas = len(filas)
    return {
        "total_revisadas": revisadas,
        "fallas_audio": audio_total,
        "solo_audio": solo_audio,
        "con_gestion": max(revisadas - solo_audio - administrativas - sin_clasificar, 0),
        "administrativas": administrativas,
        "sin_clasificar": sin_clasificar,
        "criterios": criterios,
        "aspectos": aspectos,
        "recomendaciones": recomendaciones,
        "fortalezas": fortalezas,
    }
