#!/usr/bin/env python3
"""Build the Journal's preprojected terrain image from public-domain GIS data.

Requires Python 3.10+, NumPy, and Pillow; no website runtime dependencies.
Run from the repository root: python tools/build-china-relief.py
The 10.85 MB source archive stays in the OS temporary cache, outside the repo.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import re
import tempfile
from urllib.request import Request, urlopen
import zipfile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://naturalearth.s3.amazonaws.com/50m_raster/SR_50M.zip"
SOURCE_SHA256 = "ff810f5f2747463fd8ffa612b23e5f5e5d593a345218976872b6749610976ab7"
SOURCE_PAGE = "https://www.naturalearthdata.com/downloads/50m-raster-data/50m-shaded-relief/"
LICENSE_URL = "https://www.naturalearthdata.com/about/terms-of-use/"
CENTRAL_MERIDIAN = 105.0
PARALLELS = (25.0, 47.0)
WATER_GRAY = 206.0  # Natural Earth's uniform water tint, made neutral for multiply.


def albers_constants():
    p1, p2 = np.radians(PARALLELS)
    n = (np.sin(p1) + np.sin(p2)) / 2
    c = np.cos(p1) ** 2 + 2 * n * np.sin(p1)
    return n, c


def fit_projection(data):
    """Recover D3's sphere-based scale/translation from rounded city centers.

    Both axes share one scale. An iterative one-pixel rejection guards against
    inset/manual label positions. All 391 current centers pass the threshold.
    The y coordinate here is rho*cos(theta), already oriented for SVG's y-down.
    """
    cities = [city for city in data["cities"] if city.get("coordinates")]
    lon_lat = np.radians(np.array([city["coordinates"] for city in cities]))
    centers = np.array([city["center"] for city in cities], dtype=float)
    n, c = albers_constants()
    rho = np.sqrt(c - 2 * n * np.sin(lon_lat[:, 1])) / n
    theta = n * (lon_lat[:, 0] - math.radians(CENTRAL_MERIDIAN))
    raw = np.column_stack((rho * np.sin(theta), rho * np.cos(theta)))
    design = np.zeros((len(cities) * 2, 3))
    design[0::2, 0], design[1::2, 0] = raw[:, 0], raw[:, 1]
    design[0::2, 1], design[1::2, 2] = 1, 1
    keep = np.ones(len(cities), dtype=bool)
    for _ in range(10):
        rows = np.repeat(keep, 2)
        affine = np.linalg.lstsq(design[rows], centers.ravel()[rows], rcond=None)[0]
        residual = np.linalg.norm((design @ affine).reshape(-1, 2) - centers, axis=1)
        updated = residual < 1.0
        if np.array_equal(updated, keep):
            break
        keep = updated
    if keep.sum() < 300 or residual[keep].max() > 0.12:
        raise RuntimeError("Map projection no longer matches the reference city centers")
    return affine, {
        "referenceCount": len(cities),
        "inlierCount": int(keep.sum()),
        "rejectedIds": [cities[i]["id"] for i in np.flatnonzero(~keep)],
        "rmsSvgPixels": float(np.sqrt(np.mean(residual[keep] ** 2))),
        "maxSvgPixels": float(residual[keep].max()),
        "p95SvgPixels": float(np.percentile(residual[keep], 95)),
    }


def get_archive(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.is_file():
        request = Request(SOURCE_URL, headers={"User-Agent": "Journal-relief-generator/1.0"})
        with urlopen(request, timeout=60) as response:
            source = response.read()
        with zipfile.ZipFile(io.BytesIO(source)) as archive:
            if "SR_50M.tif" not in archive.namelist():
                raise RuntimeError("Downloaded archive has no SR_50M.tif")
        path.write_bytes(source)
    source = path.read_bytes()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise RuntimeError("The source archive changed; review its provenance before updating the pinned checksum")
    return source


def reproject(source, world, affine, view_box, size, contrast):
    """Inverse spherical Albers projection and bilinear geographic sampling."""
    width, height = size
    vx, vy, vw, vh = view_box
    scale, tx, ty = affine
    n, c = albers_constants()
    # Read the affine georeferencing from the source's .tfw pixel-center file.
    dx, ry, rx, dy, lon0, lat0 = world
    if abs(ry) > 1e-12 or abs(rx) > 1e-12:
        raise RuntimeError("Rotated input grids require a full raster reprojection")
    result = np.full((height, width), 255, dtype=np.uint8)
    svg_x = vx + (np.arange(width) + 0.5) * vw / width
    raw_x = (svg_x - tx) / scale
    for row in range(0, height, 128):
        stop = min(row + 128, height)
        svg_y = vy + (np.arange(row, stop) + 0.5) * vh / height
        raw_y = ((svg_y - ty) / scale)[:, None]
        rho2 = raw_x[None, :] ** 2 + raw_y ** 2
        latitude = np.arcsin(np.clip((c - n * n * rho2) / (2 * n), -1, 1))
        longitude = np.arctan2(raw_x[None, :], raw_y) / n + math.radians(CENTRAL_MERIDIAN)
        px = (np.degrees(longitude) - lon0) / dx
        py = (np.degrees(latitude) - lat0) / dy
        valid = (px >= 0) & (px < source.shape[1] - 1) & (py >= 0) & (py < source.shape[0] - 1)
        px = np.clip(px, 0, source.shape[1] - 2)
        py = np.clip(py, 0, source.shape[0] - 2)
        ix, iy = px.astype(np.int32), py.astype(np.int32)
        fx, fy = px - ix, py - iy
        sampled = (
            source[iy, ix] * (1 - fx) * (1 - fy)
            + source[iy, ix + 1] * fx * (1 - fy)
            + source[iy + 1, ix] * (1 - fx) * fy
            + source[iy + 1, ix + 1] * fx * fy
        )
        # Only shadows affect the city colors; the uniform ocean tint and
        # illuminated terrain become white, neutral under multiply blending.
        tone = np.clip(255 - contrast * np.maximum(WATER_GRAY - sampled, 0), 0, 255)
        result[row:stop] = np.where(valid, np.rint(tone), 255).astype(np.uint8)
    return result


def write_png(gray, path, levels):
    # A small, strictly grayscale indexed palette compresses the static texture.
    indices = np.rint(gray.astype(float) * (levels - 1) / 255).astype(np.uint8)
    image = Image.fromarray(indices, mode="P")
    palette = [round(i * 255 / (levels - 1)) for i in range(levels)]
    image.putpalette([value for value in palette for _ in range(3)] + [0] * (768 - 3 * levels))
    image.save(path, optimize=True, bits=4 if levels <= 16 else 8)


def outline_mask(path, view_box, size):
    """Rasterize the existing compact SVG outline to avoid encoding hidden land.

    The map's outline uses M, l, and z only. Restricting this small parser to
    those commands also makes an unexpected future path change fail clearly.
    A one-pixel expansion leaves edge clipping to the application's SVG.
    """
    if set(re.findall(r"[A-Za-z]", path)) - {"M", "l", "z"}:
        raise RuntimeError("Unsupported outline commands: use an SVG rasterizer")
    vx, vy, vw, vh = view_box
    sx, sy = size[0] / vw, size[1] / vh
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    tokens = re.findall(r"[Mlz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?", path)
    command, polygon, x, y, i = None, [], 0.0, 0.0, 0
    while i < len(tokens):
        token = tokens[i]
        if token in {"M", "l", "z"}:
            command = token
            i += 1
            if command == "z":
                if len(polygon) >= 3:
                    draw.polygon(polygon, fill=255)
                polygon = []
                continue
        a, b = float(tokens[i]), float(tokens[i + 1])
        i += 2
        if command == "M":
            x, y = a, b
        else:
            x, y = x + a, y + b
        polygon.append(((x - vx) * sx, (y - vy) * sy))
    return np.asarray(mask.filter(ImageFilter.MaxFilter(3))) != 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--width", type=int, default=1600)
    parser.add_argument("--levels", type=int, default=16, choices=(16, 32, 64, 128, 256))
    parser.add_argument("--contrast", type=float, default=1.2)
    parser.add_argument("--cache", type=Path, default=Path(tempfile.gettempdir()) / "codex-china-relief")
    parser.add_argument("--output", type=Path, default=ROOT / "source/travel/china-relief.png")
    args = parser.parse_args()
    map_path = ROOT / "source/travel/china-cities.json"
    map_bytes = map_path.read_bytes()
    data = json.loads(map_bytes)
    affine, residual = fit_projection(data)
    view_box = data["viewBox"]
    size = (args.width, round(args.width * view_box[3] / view_box[2]))
    archive_bytes = get_archive(args.cache / "SR_50M.zip")
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        raster_bytes = archive.read("SR_50M.tif")
        source = np.array(Image.open(io.BytesIO(raster_bytes)).convert("L"))
        world = list(map(float, archive.read("SR_50M.tfw").decode().split()))
        archive_version = archive.read("SR_50M.VERSION.txt").decode().strip()
    gray = reproject(source, world, affine, view_box, size, args.contrast)
    gray = np.where(outline_mask(data["outlinePath"], view_box, size), gray, 255).astype(np.uint8)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    write_png(gray, args.output, args.levels)
    metadata = {
        "asset": args.output.name,
        "size": list(size),
        "bytes": args.output.stat().st_size,
        "assetSha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
        "source": {
            "name": "Natural Earth 1:50m Shaded Relief Basic (SR_50M)",
            "description": "Land shaded relief derived from downsampled SRTM Plus elevation data, clipped to the 1:50m coastline.",
            "pageUrl": SOURCE_PAGE,
            "downloadUrl": SOURCE_URL,
            "siteAdvertisedVersion": "3.2.0",
            "archiveVersionFile": archive_version,
            "retrieved": "2026-10-02",
            "sourceRasterSize": [int(source.shape[1]), int(source.shape[0])],
            "sourceArchiveSha256": hashlib.sha256(archive_bytes).hexdigest(),
            "sourceRasterSha256": hashlib.sha256(raster_bytes).hexdigest(),
            "sourceWorldFile": world,
            "license": "Public domain",
            "licenseUrl": LICENSE_URL,
            "licenseSummary": "Natural Earth permits use, modification, and electronic redistribution for personal, educational, and commercial purposes; no permission or attribution is required.",
            "attribution": "Made with Natural Earth.",
        },
        "projection": {
            "name": "Spherical Albers equal-area, matching the existing D3 map",
            "centralMeridianDegrees": CENTRAL_MERIDIAN,
            "standardParallelsDegrees": list(PARALLELS),
            "viewBox": view_box,
            "coordinateFormula": "x=s*rho*sin(n*(lon-105deg))+tx; y=s*rho*cos(n*(lon-105deg))+ty; rho=sqrt(C-2*n*sin(lat))/n",
            "scale": float(affine[0]),
            "translateX": float(affine[1]),
            "translateY": float(affine[2]),
            "cityCenterResidual": residual,
            "mapInputSha256": hashlib.sha256(map_bytes).hexdigest(),
        },
        "processing": {
            "generator": "tools/build-china-relief.py",
            "command": f"python tools/build-china-relief.py --width {args.width} --levels {args.levels} --contrast {args.contrast}",
            "resampling": "Bilinear inverse projection, sampling each output pixel center",
            "tone": f"clamp(255 - {args.contrast} * max(206 - sourceGray, 0), 0, 255)",
            "palette": f"{args.levels} evenly spaced grayscale values",
            "outsideOutline": "White outside the existing main outline, with one output pixel of padding; the SVG retains final clipping control.",
            "display": "Place over city fills as multiply-blended SVG image at x=0 y=0 width=1000 height=851, clip to the main outline, and keep borders and labels above it.",
            "limitations": "Static shaded-relief texture, not elevation geometry. The South China Sea inset has its own schematic coordinates and is not covered by this layer. Natural Earth's 1:50m coastline is generalized; the application's existing boundary clip controls the displayed outline.",
        },
    }
    metadata_path = args.output.with_suffix(".metadata.json")
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"asset": str(args.output), "size": size, "bytes": metadata["bytes"], "projectionResidual": residual}, indent=2))


if __name__ == "__main__":
    main()
