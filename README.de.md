<div align="center">

# Game-Morse-Adventurer

### Ein Pixel-Art-Abenteuer rund um eine CW-Amateurfunkstation

[**English**](./README.md) · [**简体中文**](./README.zh-CN.md) · [**繁體中文**](./README.zh-TW.md) · [**日本語**](./README.ja.md) · [**Español**](./README.es.md) · [**Deutsch**](./README.de.md) · [**Русский**](./README.ru.md)

[![Windows portable](https://github.com/Arsenic-er/Game-Morse-Adventurer/actions/workflows/windows-portable.yml/badge.svg)](https://github.com/Arsenic-er/Game-Morse-Adventurer/actions/workflows/windows-portable.yml)

</div>

> [!IMPORTANT]
> Alle Rufzeichen in diesem Spiel sind frei erfunden und stehen in keinem Zusammenhang mit realen Rufzeichen. Ähnlichkeiten sind rein zufällig. Das Projekt ist noch ein Prototyp; Hinweise auf Probleme sind willkommen.

<p align="center">
  <img src="./docs/images/game-morse-adventurer-hero.png" alt="Game-Morse-Adventurer — Freunde campen und betreiben eine Amateurfunkstation an einem Bergsee" width="100%">
</p>

**Schlagwörter:** Morsecode · Amateurfunk · CW · Telegrafie · Spiel

## Über das Spiel

Game-Morse-Adventurer ist ein lokal ausgeführter Windows-Spielprototyp zum Erlernen und Anwenden des Morsecodes an einer fiktiven Amateurfunkstation. Betritt die Station, um den Empfänger zu öffnen und laufendes Hintergrundrauschen zu hören, rufe mit einer Handtaste oder einem Automatik-Paddle CQ, warte auf eine ausbreitungsabhängige Antwort einer fiktiven Station, schließe das QSO ab und erkunde die Bedingungen auf einer Offline-Weltkarte.

## Höhepunkte

- Kantige, dunkle Pixeloberfläche mit Fusion Bold Pixel für Englisch, Chinesisch und Japanisch sowie Press Start 2P für Spanisch, Deutsch und Russisch.
- Benutzeroberfläche in Englisch, vereinfachtem Chinesisch, traditionellem Chinesisch, Japanisch, Spanisch, Deutsch und Russisch.
- Standortabhängige Home-Verwaltungszentrale mit per Filter hervorgehobener Station, Lager, Shop, Logbuch und Erfolgen sowie einem neuen interaktiven `MORSE CODE`-Buch, das die Übungen öffnet, ohne den aktiven Spielstand zu verlassen.
- Drei lokale Speicherplätze mit einem bis zu sieben Zeichen langen Rufzeichen in Großbuchstaben, festem Startort, austauschbarer Ausrüstung und Credits.
- Standardkonformes Morse-Timing, fester 650-Hz-Mithörton, Dekodierung, Rhythmuswertung und WPM-Erkennung für die Handtaste.
- Handtaste mit `Space`; Automatik-Paddle mit einstellbaren 5–40 WPM, `Z` für Punkt und `X` für Strich sowie fortlaufender Ausgabe beim Gedrückthalten.
- Eigenständige Übungen für Zeichen, fiktive Rufzeichen, Handtaste und Paddle. Die Schwierigkeitsgrade Geführt, Standard und Herausforderung bestimmen Empfangstempo und Lernziele; in jedem Modus wird jeweils eine Lektion nach der anderen freigeschaltet.
- Der Rufzeichenempfang bietet fünf Trainingsfilter: Alle, Japan, Vereinigte Staaten, China und Europa. Jede einzelne Region enthält acht eigens für das Spiel erfundene Ziele mit dem Präfix `SIM`, die pro Lektion zu zweit eingeführt werden. Es handelt sich um fiktive Übungsbezeichnungen, nicht um reale Rufzeichenzuteilungen oder echte regionale Präfixdaten.
- Die Rufzeichenregion lässt sich nur ändern, solange die aktuelle Sitzung noch keine Antworteingabe, keinen CW-Impuls und keinen gewerteten Versuch enthält; während der Schwächenwiederholung ist sie stets gesperrt. Ein Regionswechsel leert das Fenster der zuletzt verwendeten Rufzeichen, setzt aber weder Langzeitstatistiken und Schwächengewichte noch formale Lektionswertung, Freischaltungen oder den Gesamtstand der 19 Lektionen zurück.
- Ein deterministischer gemischter Beutel verhindert Wiederholungen innerhalb einer Runde und meidet, sofern der aktive Lektionspool groß genug ist, die vier zuletzt gestellten Ziele. Jede Aufgabe wird höchstens einmal gewertet. Die Übungsübersicht zeigt Versuche, Genauigkeit, Rhythmus, schwache Zeichen und den Lektionsfortschritt.
- Jede Lektion nennt sowohl die neu eingeführten Ziele als auch ihren vollständigen Wiederholungspool. Eine Live-Lernstandskarte erklärt den gewerteten Block, die Bestehensregel, die verbleibenden Fragen, die noch benötigten richtigen Antworten und ob der aktuelle Block noch bestanden werden kann.
- Bei aktivem Spielstand werden Langzeitergebnisse, Lehrplanfortschritt und die Regionswahl des Rufzeichenempfangs getrennt nach Modus gespeichert. Das Übungsdatenschema v3 migriert ältere Spielstände sicher, setzt fehlende oder ungültige Regionen auf Alle und filtert die zuletzt verwendeten Ziele nach dem gewählten fiktiven Pool. Ohne ausgewählten Spielstand bleiben die Übungen verfügbar, die Daten gelten jedoch nur für die aktuelle Sitzung.
- Das `MORSE CODE`-Buch in Home zeigt Anzahl und Prozentsatz der abgeschlossenen Lektionen über alle 19 Lektionen der vier Modi und aktualisiert sich sofort nach der Rückkehr aus den Übungen.
- Die Übungsseitenleiste bietet eine Lehrplanübersicht aller vier Modi mit abgeschlossenen Lektionen, Gesamtzahl und Prozentwert. Hat der gewählte Modus gespeicherte Schwächen, fixiert eine Wiederholung mit fünf Fragen ihren Zielpool zu Beginn und zieht ausschließlich aus bereits freigeschalteten schwachen Zielen.
- Die Schwächenwiederholung aktualisiert Langzeitversuche, richtige Antworten, Durchschnittswerte, Schwächengewichte, zuletzt verwendete Ziele und den letzten Übungszeitpunkt, kann aber niemals die formale Lektion, ihren Wertungsblock oder die Anzahl abgeschlossener Lektionen voranbringen, zurücksetzen oder anderweitig verändern.
- Jede richtige Wiederholungsantwort entfernt höchstens einen Schwächepunkt vom Ziel, während eine falsche Antwort weiterhin einen hinzufügt. Bei mehrstelligen Aufgaben erholt sich zuerst das zulässige Zeichen mit dem höchsten aktuellen Gewicht; Gleichstände werden nach der Reihenfolge im Ziel aufgelöst. Der Fünf-Fragen-Pool bleibt unverändert; ein Ziel mit Gewicht null verlässt den nächsten Wiederholungspool.
- Vom Spieler eingeleiteter fiktiver QSO-Ablauf: Der Empfänger öffnet automatisch, der Spieler ruft CQ, die Ausbreitung bestimmt, ob eine Station antwortet, und ein erfolgreicher Kontakt setzt sich mit Rufzeichen, RST, 73/SK, Credits und Logbucheintrag fort.
- Eine Erstwache-Einweisung und ein Dienstassistent in sieben Sprachen mit den Stufen Vollständig, Hinweise und Aus erklären jede QSO-Phase, ohne das entfernte Rufzeichen beim Blindempfang zu verraten.
- `AGN K` lässt dieselbe Gegenstation auf demselben Kanal wiederholen, ohne Ausbreitung, Versuche oder Belohnungen zu ändern. Fehlerhaft formatierte Nachrichten behalten ihren dekodierten Text zur Korrektur, statt das QSO nach zwei Fehlern zu beenden.
- QSO-Nachrichten werden in Funkreihenfolge geprüft: Rufzeichen der Gegenstation, `DE`, eigenes Rufzeichen, `RST`, Rapport, `73`, danach `K`. Falsch platzierte oder fehlende Betriebszeichen erhalten eine konkrete Korrektur statt einer falschen Freigabe.
- Dauerhafte QSO-Ergebnisseiten und Logbucheinträge enthalten Rufzeichen, Region, Entfernung, RST, Ausbreitung, Ausrüstung, WPM, Sendegenauigkeit, Rhythmus, Anzahl der Wiederholungsanforderungen und eine zeilenweise Betriebsauswertung angenommener, abgelehnter und wiederholter Versuche.
- Jedes abgerechnete QSO speichert eine dauerhafte Aufschlüsselung in sieben Sprachen: 100 Basis-Credits, +50 für selbstständige Wache, +75 für eine P0–P2-Schwachsignalverbindung, +20 für die erste Region und +25 für einen neuen Entfernungsrekord. Ergebnisseite und Home-Logbuch lesen dieselbe Schema-v4-Aufschlüsselung; ältere Logs behalten ihre historische Summe ohne nachträgliche Auszahlung.
- Ein Erfolgsarchiv in sieben Sprachen leitet sechs dauerhafte Meilensteine aus beständigen QSO-Daten und aufbewahrten Logbüchern ab, ohne Belohnungen doppelt zu vergeben. Neu freigeschaltete QSO-Erfolge erscheinen sofort in einer nicht blockierenden Benachrichtigungswarteschlange.
- Atomare, idempotente Credit-Abrechnung verhindert, dass ein abgeschlossenes QSO mehr als einmal belohnt wird.
- Ein Stationsshop in sieben Sprachen unterstützt atomare Käufe, dauerhaften Besitz und Ausrüstungswechsel ausschließlich im Lager.
- Das erste Ersatzfunkgerät, das fiktive MICA-8, kostet 800 Credits und ist von offenen uSDX/uSDR-QRP-Konzepten inspiriert: ein 5-W-Hardwareprofil für acht Bänder, 20 % weniger Empfängerrauschen, 15 % geringere wahrgenommene QSB-Tiefe durch AGC sowie getrennte Pixelgrafiken für Leerlauf und TX, deren rote Diode nur beim Senden leuchtet. Der aktuelle Spielbetrieb bleibt auf 21,060 MHz CW festgelegt.
- Ein einzelner Zubehörplatz unterstützt den 300 Credits teuren CW-500-Audiofilter mit 650 Hz Mittenfrequenz, 500 Hz Bandbreite und 35 % weniger Empfängerrauschen; das ausgerüstete Zubehör wird im QSO-Log gespeichert.
- Die Stationsuhren zeigen sowohl die Ortszeit des gewählten Standorts als auch UTC.
- Deterministische Offline-Ausbreitung auf Grundlage von Stationsstandort, UTC und 21,060 MHz.
- Die Ausbreitungsstufen beeinflussen NPC-Verfügbarkeit, Signalverstärkung, Rauschen, QSB und kleine Frequenzabweichungen.
- Lokaler portabler Build für Windows x64; zum Spielen werden weder Konto noch Netzwerkverbindung benötigt.

## Steuerung

| Aktion | Taste |
| --- | --- |
| Handtaste | `Space` gedrückt halten |
| Automatik-Paddle — Punkt | `Z` |
| Automatik-Paddle — Strich | `X` |
| Erfasstes CQ oder Antwort senden | `F2` |
| Log eines abgeschlossenen QSO speichern | `F3` |

## Entwicklung

```bash
pnpm install
pnpm test
pnpm run dev
pnpm run desktop:build
```

Die automatisierte Testsuite deckt CW-Kern und wiederholenden Keyer, Empfänger-Audiofilterung, Übungsengine, regionale Kataloge und Pools fiktiver Rufzeichen, Migration auf Schema v3, Isolation und Neuladen von Einstellungen, Sperrung der Regionswahl, Lehrplanübersichten für vier Modi, Isolation des Schwächen-Wiederholungspools, Schwächenabbau, dauerhaften Lernstand und Invarianten formaler Lektionen ab. Ebenfalls geprüft werden die Blindempfang-QSO-Zustandsmaschine, strikte QSO-Reihenfolge und `AGN K`-Wiederholungen, Verlauf der Betriebsauswertung, Berechtigung für selbstständige Wachen, CQ-Antwortwahrscheinlichkeit, dauerhafte QSO-Logs und Ergebnisse, Ableitung von Erfolgen, idempotente Credit-Abrechnung, Shop-Wirtschaft, Besitz und Ausrüstung von Funkgeräten und Zubehör, Ausbreitungsmodell, Kartenprojektion und Speicherregeln.

## Projektstatus

Version **v0.25.0** schützt ein laufendes oder abgeschlossenes, aber noch nicht gespeichertes QSO vor versehentlichem Verlust. Die Rückkehr zur Zentrale und ein neues QSO verwenden denselben Pixelhinweis in sieben Sprachen; während er geöffnet ist, pausieren Tastung, Empfängerrauschen, Antworttimer und NPC-Wiedergabe. Nach Abbruch wird derselbe Kontakt fortgesetzt. Beim Schließen des Fensters oder Neuladen erscheint ein entsprechender nativer Hinweis. Eine unberührte Wache und ein gespeichertes Ergebnis können weiterhin sofort verlassen werden. QSO-Logschema v4, sieben Sprachen, regionales Training mit fiktiven Rufzeichen, Schwächenwiederholung und der Fortschritt über 19 Lektionen bleiben erhalten. Jede akzeptierte Änderung an `main` wird als portables Windows-x64-Artefakt mit Prüfsumme paketiert.

## Rechte und Drittsoftware

Die ursprünglichen Projektmaterialien sind urheberrechtlich geschützt: Copyright © 2026 Arsenic-er (koko), alle Rechte vorbehalten. Für den ursprünglichen Spielcode und die Grafiken wird keine Open-Source-Lizenz erteilt. Drittanbieterkomponenten unterliegen weiterhin ihren eigenen Lizenzen; siehe [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
