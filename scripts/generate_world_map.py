#!/usr/bin/env python3
"""Render the game's pixel-art equirectangular world-map runtime asset.

The input is Natural Earth's 1:110m land GeoJSON. Download it from:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, PngImagePlugin


WORK_WIDTH = 1024
WORK_HEIGHT = 512
OUTPUT_SCALE = 2


def project(longitude: float, latitude: float) -> tuple[float, float]:
    """Project WGS84 longitude/latitude onto the 2:1 canvas."""
    return (
        (longitude + 180.0) / 360.0 * WORK_WIDTH,
        (90.0 - latitude) / 180.0 * WORK_HEIGHT,
    )


def unwrap_ring(ring: list[list[float]]) -> list[tuple[float, float]]:
    """Keep a dateline-crossing ring local instead of spanning the whole map."""
    unwrapped: list[tuple[float, float]] = []
    previous_longitude: float | None = None
    offset = 0.0
    for longitude, latitude in ring:
        longitude = float(longitude)
        if previous_longitude is not None:
            delta = longitude + offset - previous_longitude
            if delta > 180.0:
                offset -= 360.0
            elif delta < -180.0:
                offset += 360.0
        adjusted = longitude + offset
        unwrapped.append(project(adjusted, float(latitude)))
        previous_longitude = adjusted
    return unwrapped


def draw_wrapped_polygon(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill: int) -> None:
    for shift in (-WORK_WIDTH, 0, WORK_WIDTH):
        shifted = [(x + shift, y) for x, y in points]
        if max(x for x, _ in shifted) >= 0 and min(x for x, _ in shifted) < WORK_WIDTH:
            draw.polygon(shifted, fill=fill)


def render_land_mask(geojson: dict) -> Image.Image:
    mask = Image.new("L", (WORK_WIDTH, WORK_HEIGHT), 0)
    draw = ImageDraw.Draw(mask)
    for feature in geojson["features"]:
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "Polygon":
            continue
        bbox = feature.get("bbox") or []
        # Match the established game map by leaving Antarctica outside the art.
        if len(bbox) == 4 and float(bbox[3]) < -60:
            continue
        rings = geometry.get("coordinates") or []
        if not rings:
            continue
        draw_wrapped_polygon(draw, unwrap_ring(rings[0]), 255)
        for hole in rings[1:]:
            draw_wrapped_polygon(draw, unwrap_ring(hole), 0)
    return mask


def pixel_noise(rng: np.random.Generator, height: int, width: int, block: int) -> np.ndarray:
    noise = rng.integers(-12, 13, size=(height // block + 1, width // block + 1), dtype=np.int16)
    return np.repeat(np.repeat(noise, block, axis=0), block, axis=1)[:height, :width]


def render_map(geojson: dict) -> Image.Image:
    rng = np.random.default_rng(20260724)
    y = np.arange(WORK_HEIGHT, dtype=np.int16)[:, None]

    ocean = np.empty((WORK_HEIGHT, WORK_WIDTH, 3), dtype=np.int16)
    ocean[:, :, 0] = 2 + y // 180
    ocean[:, :, 1] = 17 + y // 65
    ocean[:, :, 2] = 30 + y // 48
    ocean += pixel_noise(rng, WORK_HEIGHT, WORK_WIDTH, 4)[:, :, None] // 4
    ocean = np.clip(ocean, 0, 255).astype(np.uint8)
    image = Image.fromarray(ocean, "RGB")

    grid = Image.new("RGBA", (WORK_WIDTH, WORK_HEIGHT), (0, 0, 0, 0))
    grid_draw = ImageDraw.Draw(grid)
    for longitude in range(-150, 180, 30):
        x = round((longitude + 180) / 360 * WORK_WIDTH)
        for start in range(0, WORK_HEIGHT, 5):
            grid_draw.line((x, start, x, min(start + 2, WORK_HEIGHT - 1)), fill=(16, 72, 93, 72))
    for latitude in range(-60, 90, 30):
        grid_y = round((90 - latitude) / 180 * WORK_HEIGHT)
        for start in range(0, WORK_WIDTH, 5):
            grid_draw.line((start, grid_y, min(start + 2, WORK_WIDTH - 1), grid_y), fill=(16, 72, 93, 72))
    image = Image.alpha_composite(image.convert("RGBA"), grid).convert("RGB")

    land_mask = render_land_mask(geojson)
    coarse = Image.fromarray(
        rng.integers(0, 256, size=(32, 64), dtype=np.uint8),
        "L",
    ).resize((WORK_WIDTH, WORK_HEIGHT), Image.Resampling.BILINEAR)
    coarse_array = np.asarray(coarse, dtype=np.int16) - 128
    fine = pixel_noise(rng, WORK_HEIGHT, WORK_WIDTH, 3)
    latitude_light = np.abs(y - WORK_HEIGHT // 2) // 18
    diagonal = (((np.arange(WORK_WIDTH)[None, :] + y * 2) // 19) % 3 - 1) * 3
    shade = coarse_array // 8 + fine // 2 + diagonal - latitude_light

    land = np.empty((WORK_HEIGHT, WORK_WIDTH, 3), dtype=np.int16)
    land[:, :, 0] = 25 + shade
    land[:, :, 1] = 89 + shade * 2
    land[:, :, 2] = 66 + shade
    land = np.clip(land, 12, 145).astype(np.uint8)
    image.paste(Image.fromarray(land, "RGB"), mask=land_mask)

    coastline = np.asarray(land_mask.filter(ImageFilter.MaxFilter(3)), dtype=np.int16) - np.asarray(land_mask, dtype=np.int16)
    coastline_mask = Image.fromarray(np.where(coastline > 0, 150, 0).astype(np.uint8), "L")
    image.paste((15, 78, 63), mask=coastline_mask)

    return image.resize(
        (WORK_WIDTH * OUTPUT_SCALE, WORK_HEIGHT * OUTPUT_SCALE),
        Image.Resampling.NEAREST,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="Natural Earth ne_110m_land.geojson")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "public" / "assets" / "world-map.png",
    )
    args = parser.parse_args()

    source_bytes = args.source.read_bytes()
    geojson = json.loads(source_bytes)
    image = render_map(geojson)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("Projection", "Equirectangular (Plate Carree), WGS84")
    metadata.add_text("Land data", "Natural Earth 1:110m land, public domain")
    metadata.add_text("Source SHA256", hashlib.sha256(source_bytes).hexdigest())
    image.save(args.output, optimize=True, pnginfo=metadata)


if __name__ == "__main__":
    main()
