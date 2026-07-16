#!/usr/bin/env python3
"""
download_diffusionpen.py
------------------------
Downloads the DiffusionPen Hebrew Handwriting dataset from Hugging Face
and converts it to Kraken ground-truth format (image + .gt.txt pairs).

Dataset: https://huggingface.co/datasets/DiffusionPen/DiffusionPen-Hebrew
  - 149,952 synthetic Hebrew handwriting line images
  - Pre-split: train (119,986) / val (14,855) / test (15,111)

Usage:
    pip install huggingface_hub datasets pillow tqdm
    python download_diffusionpen.py --output ./diffusionpen/

Output structure:
    diffusionpen/
      train/
        line_000001.png
        line_000001.gt.txt
        ...
      val/
        ...
      test/
        ...
"""

import argparse
import os
from pathlib import Path

try:
    from datasets import load_dataset
    from PIL import Image
    from tqdm import tqdm
except ImportError:
    print("ERROR: Missing dependencies.")
    print("Run: pip install datasets pillow tqdm")
    raise


def save_split(dataset_split, output_dir: Path, split_name: str):
    """Save one split of the dataset as Kraken ground-truth pairs."""
    split_dir = output_dir / split_name
    split_dir.mkdir(parents=True, exist_ok=True)

    print(f"\nSaving {split_name} split ({len(dataset_split)} samples) to {split_dir}")

    for idx, sample in enumerate(tqdm(dataset_split, desc=split_name)):
        stem = f"line_{idx:06d}"

        # Save image
        img: Image.Image = sample["image"]
        if img.mode != "L":
            img = img.convert("L")  # Grayscale
        img.save(split_dir / f"{stem}.png")

        # Save ground truth text
        text = sample.get("text", sample.get("label", "")).strip()
        (split_dir / f"{stem}.gt.txt").write_text(text, encoding="utf-8")

    print(f"  Saved {len(dataset_split)} pairs to {split_dir}")


def main():
    parser = argparse.ArgumentParser(description="Download DiffusionPen Hebrew dataset for Kraken training")
    parser.add_argument("--output", default="./diffusionpen", help="Output directory (default: ./diffusionpen)")
    parser.add_argument("--splits", nargs="+", default=["train", "validation", "test"],
                        help="Dataset splits to download (default: train validation test)")
    args = parser.parse_args()

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Downloading DiffusionPen Hebrew Handwriting Dataset from Hugging Face...")
    print("This may take a while (~5-10 GB download).")
    print()

    dataset = load_dataset("DiffusionPen/DiffusionPen-Hebrew", trust_remote_code=True)

    split_map = {
        "train": "train",
        "validation": "val",
        "test": "test",
    }

    for hf_split, out_split in split_map.items():
        if hf_split in args.splits or out_split in args.splits:
            if hf_split in dataset:
                save_split(dataset[hf_split], output_dir, out_split)
            else:
                print(f"  WARN: Split '{hf_split}' not found in dataset.")

    print("\n✅ Download complete.")
    print("\nNext step — train Kraken on the training split:")
    print(f"  ketos train \\")
    print(f"    -o models/hebrew_diffusionpen_v1 \\")
    print(f"    -t {output_dir}/train/ \\")
    print(f"    -e {output_dir}/val/ \\")
    print(f"    --load $(kraken list | grep arabic | head -1) \\")
    print(f"    --resize add \\")
    print(f"    -r 0.0001 \\")
    print(f"    --batch-size 16")


if __name__ == "__main__":
    main()
