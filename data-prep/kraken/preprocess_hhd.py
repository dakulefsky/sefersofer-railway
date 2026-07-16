#!/usr/bin/env python3
"""
preprocess_hhd.py
-----------------
Crops HHD (Hebrew Handwriting Dataset) full-page form scans into
line-level image/text pairs suitable for Kraken HTR training.

Usage:
    python preprocess_hhd.py --input ./hhd/raw/ --output ./hhd/lines/

Requirements:
    pip install pillow opencv-python numpy tqdm

The HHD dataset contains:
- PNG scans of handwritten Hebrew forms
- XML annotation files with bounding boxes and transcriptions

Output format (Kraken ground truth):
    line_0001.png   — cropped line image (grayscale, normalized height)
    line_0001.gt.txt — UTF-8 Hebrew transcription, right-to-left
"""

import argparse
import os
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
    from tqdm import tqdm
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install pillow numpy tqdm")
    raise


def parse_args():
    parser = argparse.ArgumentParser(description="Preprocess HHD dataset for Kraken training")
    parser.add_argument("--input", required=True, help="Path to raw HHD dataset directory")
    parser.add_argument("--output", required=True, help="Output directory for line pairs")
    parser.add_argument("--height", type=int, default=64, help="Target line height in pixels (default: 64)")
    parser.add_argument("--min-width", type=int, default=50, help="Minimum line width to include (default: 50)")
    return parser.parse_args()


def find_annotation_files(input_dir: Path):
    """Find all XML annotation files in the HHD directory."""
    return list(input_dir.rglob("*.xml"))


def crop_and_normalize(image: Image.Image, bbox: tuple, target_height: int) -> Image.Image:
    """Crop a bounding box from the image and normalize to target height."""
    x, y, w, h = bbox
    if h <= 0 or w <= 0:
        return None

    cropped = image.crop((x, y, x + w, y + h))

    # Convert to grayscale
    cropped = cropped.convert("L")

    # Normalize height while preserving aspect ratio
    aspect = w / h
    new_width = max(int(target_height * aspect), 1)
    cropped = cropped.resize((new_width, target_height), Image.LANCZOS)

    return cropped


def process_annotation(xml_path: Path, output_dir: Path, target_height: int, min_width: int, counter: list):
    """Process a single HHD annotation XML file."""
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except ET.ParseError as e:
        print(f"  WARN: Could not parse {xml_path.name}: {e}")
        return 0

    # Find corresponding image file
    image_path = xml_path.with_suffix(".png")
    if not image_path.exists():
        image_path = xml_path.with_suffix(".jpg")
    if not image_path.exists():
        print(f"  WARN: No image found for {xml_path.name}")
        return 0

    try:
        image = Image.open(image_path)
    except Exception as e:
        print(f"  WARN: Could not open image {image_path.name}: {e}")
        return 0

    saved = 0

    # HHD XML structure: <form> > <line> > <word> with bounding boxes and text
    # Adjust namespace/tag names based on actual HHD XML structure
    for line_elem in root.iter("line"):
        # Get line bounding box
        try:
            x = int(line_elem.get("x", 0))
            y = int(line_elem.get("y", 0))
            w = int(line_elem.get("width", 0))
            h = int(line_elem.get("height", 0))
        except (ValueError, TypeError):
            continue

        if w < min_width or h < 10:
            continue

        # Get transcription text
        text = line_elem.get("text", "").strip()
        if not text:
            # Try to assemble from child word elements
            words = [w_elem.get("text", "") for w_elem in line_elem.iter("word")]
            text = " ".join(w for w in words if w).strip()

        if not text:
            continue

        # Crop and normalize
        line_img = crop_and_normalize(image, (x, y, w, h), target_height)
        if line_img is None or line_img.width < min_width:
            continue

        # Save pair
        idx = counter[0]
        counter[0] += 1
        stem = f"line_{idx:06d}"

        line_img.save(output_dir / f"{stem}.png")
        (output_dir / f"{stem}.gt.txt").write_text(text, encoding="utf-8")
        saved += 1

    return saved


def main():
    args = parse_args()
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        print(f"ERROR: Input directory does not exist: {input_dir}")
        return

    xml_files = find_annotation_files(input_dir)
    if not xml_files:
        print(f"ERROR: No XML annotation files found in {input_dir}")
        print("Make sure you've extracted the HHD dataset correctly.")
        return

    print(f"Found {len(xml_files)} annotation files in {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Target line height: {args.height}px")
    print()

    counter = [0]
    total_saved = 0

    for xml_path in tqdm(xml_files, desc="Processing"):
        saved = process_annotation(xml_path, output_dir, args.height, args.min_width, counter)
        total_saved += saved

    print(f"\nDone. Saved {total_saved} line pairs to {output_dir}")
    print(f"\nNext step — train Kraken:")
    print(f"  ketos train -o models/hebrew_hhd_v1 -t {output_dir}/ --resize add")


if __name__ == "__main__":
    main()
