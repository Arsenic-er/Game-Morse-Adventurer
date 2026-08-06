<div align="center">

# Game-Morse-Adventurer

### Una aventura pixel art de estación de radioaficionado CW

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md) · [**Español**](./README.es.md) · [**Deutsch**](./README.de.md) · [**Русский**](./README.ru.md)

[![Windows portable](https://github.com/Arsenic-er/Game-Morse-Adventurer/actions/workflows/windows-portable.yml/badge.svg)](https://github.com/Arsenic-er/Game-Morse-Adventurer/actions/workflows/windows-portable.yml)

</div>

> [!IMPORTANT]
> Todos los indicativos del juego son ficticios y no guardan relación con indicativos reales. Cualquier parecido es pura coincidencia. El proyecto sigue siendo un prototipo; se agradece cualquier informe de problemas.

<p align="center">
  <img src="./docs/images/game-morse-adventurer-hero.png" alt="Game-Morse-Adventurer — un grupo de amigos acampa y opera una estación de radioaficionado junto a un lago de montaña" width="100%">
</p>

**Etiquetas:** código Morse · radioafición · CW · telegrafía · videojuego

## Acerca del juego

Game-Morse-Adventurer es un prototipo de juego local para Windows dedicado al aprendizaje y uso del código Morse en una estación ficticia de radioaficionado. Entra en la estación para abrir el receptor y oír ruido de fondo en directo, llama CQ con una llave vertical o un manipulador automático, espera una respuesta ficticia condicionada por la propagación, completa el QSO y explora las condiciones en un mapa mundial sin conexión.

## Características principales

- Interfaz pixel art oscura y de bordes definidos, con Fusion Bold Pixel para inglés, chino y japonés, y Press Start 2P para español, alemán y ruso.
- Interfaces en inglés, chino simplificado, chino tradicional, japonés, español, alemán y ruso.
- Centro de gestión Home adaptado a la ubicación, con estación, almacén, tienda, registro y logros resaltados mediante filtros, además de un nuevo punto interactivo en el libro `MORSE CODE` que abre las prácticas sin abandonar la partida activa.
- Tres ranuras de guardado locales con indicativo en mayúsculas de hasta siete caracteres, ubicación inicial fija, equipo intercambiable y créditos.
- Temporización Morse estándar, tono lateral fijo de 650 Hz, decodificación, puntuación del ritmo y detección de WPM para la llave vertical.
- Llave vertical con `Space`; manipulador automático ajustable entre 5 y 40 WPM, con `Z` para el punto y `X` para la raya, incluido el envío continuo al mantener pulsada la tecla.
- Prácticas independientes de caracteres, indicativos ficticios, llave vertical y manipulador automático. Las dificultades Guiada, Estándar y Desafío fijan la velocidad de recepción y los objetivos de aprobación; en cada modo, el plan de estudios desbloquea una lección cada vez.
- La recepción de indicativos ofrece cinco filtros de entrenamiento: Todos, Japón, Estados Unidos, China y Europa. Cada región específica contiene ocho objetivos inventados para el juego con el prefijo `SIM`, introducidos de dos en dos por lección; son etiquetas ficticias de práctica, no asignaciones reales de indicativos ni datos auténticos de prefijos regionales.
- La región de indicativos solo puede cambiarse antes de que la sesión actual contenga una respuesta, un pulso CW o un intento resuelto, y queda bloqueada durante el repaso de puntos débiles. Cambiarla borra la ventana de indicativos recientes sin reiniciar las estadísticas acumuladas, los pesos de debilidad, la puntuación de las lecciones formales, los desbloqueos ni el total de 19 lecciones.
- Una bolsa barajada determinista evita repeticiones dentro de una ronda y, cuando el conjunto de la lección lo permite, aparta los cuatro objetivos más recientes. Cada ejercicio solo puede resolverse una vez. El resumen de práctica muestra intentos, precisión, ritmo, caracteres débiles y progreso de la lección.
- Cada lección identifica los objetivos nuevos y su conjunto completo de repaso. Una tarjeta de dominio en directo explica el bloque puntuado, la regla de aprobación, las preguntas restantes, los aciertos todavía necesarios y si aún es posible aprobar el bloque actual.
- Con una partida activa, los resultados acumulados, el progreso curricular y la preferencia regional de recepción de indicativos se guardan por separado para cada modo. El esquema v3 de registros de práctica migra con seguridad las partidas anteriores, asigna Todos a las regiones ausentes o no válidas y filtra los objetivos recientes según el conjunto ficticio seleccionado; sin una partida elegida, la práctica sigue disponible, pero los registros solo duran durante la sesión.
- El libro `MORSE CODE` de Home muestra el número y porcentaje de lecciones completadas entre las 19 disponibles en los cuatro modos, y se actualiza de inmediato al volver de las prácticas.
- La barra lateral de prácticas ofrece una vista general del currículo de cuatro modos con las lecciones completadas, el total y el porcentaje de cada modo. Cuando el modo seleccionado tiene debilidades registradas, un repaso de cinco preguntas fija su conjunto al inicio y solo usa objetivos débiles ya desbloqueados.
- El repaso de puntos débiles actualiza los intentos y aciertos acumulados, los promedios, los pesos de debilidad, los objetivos recientes y la última fecha de práctica, pero nunca puede avanzar, reiniciar ni modificar la lección formal, su bloque puntuado o el número de lecciones completadas.
- Cada respuesta correcta del repaso resta como máximo un punto de debilidad al objetivo; una respuesta incorrecta añade uno. En ejercicios de varios caracteres se recupera primero el carácter elegible con mayor peso, y los empates se resuelven por el orden del objetivo. El conjunto de cinco preguntas permanece fijo; un objetivo que llega a cero no aparece en el siguiente repaso.
- Bucle de QSO ficticio iniciado por el jugador: el receptor se abre automáticamente, el jugador llama CQ, la propagación determina si responde una estación y un contacto correcto continúa con indicativos, RST, 73/SK, créditos y registro.
- Informe de primera guardia y guía de tarea en siete idiomas con modos completo, pistas y desactivado; enseña cada fase del QSO sin revelar el indicativo remoto durante la recepción a ciegas.
- `AGN K` hace que la misma estación remota repita por el mismo canal sin modificar la propagación, los intentos ni las recompensas. Los mensajes mal formados conservan el texto decodificado para poder corregirlo, en lugar de finalizar el QSO tras dos errores.
- Los mensajes del QSO se validan en orden radioeléctrico: indicativo remoto, `DE`, indicativo del jugador, `RST`, reporte, `73` y `K`; las señales de procedimiento ausentes o fuera de lugar reciben una corrección específica y no un aprobado erróneo.
- Las páginas persistentes de resultado y las entradas del libro de guardia incluyen indicativo, región, distancia, RST, propagación, equipo, WPM, precisión de transmisión, ritmo, número de repeticiones solicitadas y una revisión línea por línea de los intentos aceptados, transmitidos, rechazados y repetidos.
- Cada QSO liquidado guarda un desglose permanente en siete idiomas: 100 créditos base, +50 por guardia independiente, +75 por contacto de señal débil P0–P2, +20 por la primera región y +25 por un nuevo récord de distancia. La página de resultado y el libro de guardia de Home leen el mismo desglose schema v5; los registros antiguos conservan su total histórico sin pagos retroactivos.
- Un archivo de logros en siete idiomas deriva seis hitos permanentes de las estadísticas QSO duraderas y de los registros conservados sin duplicar recompensas. Los logros recién desbloqueados aparecen de inmediato en una cola de notificaciones no bloqueante.
- La liquidación de créditos atómica e idempotente impide recompensar más de una vez un QSO completado.
- Una tienda de estación en siete idiomas permite compras atómicas, propiedad persistente y cambios de equipo únicamente desde el almacén.
- La primera radio de sustitución, la MICA-8 ficticia, cuesta 800 créditos y se inspira en conceptos QRP abiertos de uSDX/uSDR: perfil de hardware de 5 W y ocho bandas, 20 % menos ruido de recepción, QSB percibido un 15 % menos profundo gracias al AGC y arte pixelado inactivo/TX en el que el diodo rojo solo se enciende al transmitir. El juego sigue operando a 21,060 MHz en CW.
- Una única ranura de accesorio admite el filtro de audio CW-500 de 300 créditos, centrado en 650 Hz, con 500 Hz de ancho de banda y un 35 % menos de ruido de recepción; el accesorio equipado queda registrado en el QSO.
- Los relojes de la estación muestran tanto la hora local del lugar seleccionado como UTC.
- Propagación determinista sin conexión basada en la ubicación de la estación, UTC y 21,060 MHz.
- Los niveles de propagación afectan a la disponibilidad de NPC, la ganancia de señal, el ruido, el QSB y pequeños desplazamientos de frecuencia.
- Compilación portátil local para Windows x64; no se necesita cuenta ni conexión de red para jugar.

## Controles

| Acción | Control |
| --- | --- |
| Llave vertical | Mantener `Space` |
| Manipulador automático — punto | `Z` |
| Manipulador automático — raya | `X` |
| Enviar el CQ o la respuesta capturados | `F2` |
| Guardar el registro de un QSO completado | `F3` |

## Desarrollo

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

La suite automatizada cubre el núcleo CW y la repetición del manipulador, el filtrado de audio del receptor, el motor de prácticas, los catálogos y conjuntos regionales de indicativos ficticios, la migración al esquema v3, el aislamiento y la recarga de preferencias, el bloqueo del selector, los resúmenes curriculares de cuatro modos, el aislamiento del conjunto de repaso de debilidades, la recuperación de debilidades, la persistencia del dominio y las invariantes de las lecciones formales; además de la máquina de estados QSO de recepción a ciegas, el orden estricto y las repeticiones `AGN K`, el historial de revisión operativa, la elegibilidad de la guardia independiente, la probabilidad de respuesta a CQ, los registros y resultados persistentes, la derivación de logros, la liquidación idempotente de créditos, la economía de la tienda, la propiedad y configuración de radios y accesorios, el modelo de propagación, la proyección del mapa y las reglas de guardado.

## Estado del proyecto

La versión **v0.28.0** sustituye la validación binaria del formato CQ por una simulación de copia remota. Cada llamada transmitida se compara con varias formas CQ válidas y después se combina con la identidad del indicativo, el orden, el ritmo, la velocidad del jugador, la propagación y la habilidad del operador que escucha. Diez indicativos ficticios usan siete perfiles experimentales con velocidades preferidas, habilidad de recepción, paciencia, rigor de procedimiento, demora, longitud de respuesta y estilo de consulta distintos. Una llamada clara recibe respuesta dirigida; una copia parcial puede producir `?`, `AGN?`, `QRZ?` o `QRS?`; una señal reconocible pero ilegible puede provocar un CQ general, mientras que la basura total o un operador lacónico pueden quedar en silencio. Los registros schema v6 conservan calidad CQ, puntuación de copia, resultado, perfil, WPM remoto y número de consultas. Se mantienen la protección de salida de v0.25 y los siete idiomas. El mismo modelo de copia remota evalúa ahora el reporte RST/73 del jugador: una copia parcial produce `AGN? K` o `QRS? K`, un reporte ilegible se puede repetir y solo una retransmisión copiada completa y liquida el QSO. En v0.28, cinco de las diez estaciones ficticias pueden hacer una pregunta opcional según su personalidad sobre potencia, QTH, tiempo, nombre ficticio o edad ficticia; las otras cinco conservan el intercambio breve. `AGN K` repite la pregunta, `SKIP K` o `73 K` la omite, y los registros schema v6 solo guardan la pregunta, el resultado y el número de repeticiones, nunca el texto de la respuesta.

## Derechos y software de terceros

Los materiales originales del proyecto son copyright © 2026 Arsenic-er (koko); todos los derechos están reservados. No se concede ninguna licencia de código abierto sobre el código ni el arte originales del juego. Los componentes de terceros conservan sus propias licencias; consulta [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
