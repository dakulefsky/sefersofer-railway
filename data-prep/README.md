# SeferSofer — Kraken Training Data Preparation

This directory contains scripts to prepare Hebrew handwriting datasets for training
a custom [Kraken](https://kraken.re) HTR (Handwritten Text Recognition) model.

The long-term goal is to replace the OpenAI GPT-4o Vision API with a self-hosted,
free, open-source Kraken model trained on real Hebrew handwriting.

---

## Datasets

### 1. HHD — Hebrew Handwriting Dataset (Ben-Gurion University)
- **Source:** https://www.cs.bgu.ac.il/~berat/data/hhd_dataset.zip
- **Mirror:** https://www.kaggle.com/datasets/liorabergel/hhd-age
- **Content:** Real-world Hebrew handwriting form scans from multiple writers
- **Format:** Full-page form scans (PNG) — must be cropped into line-level pairs

### 2. DiffusionPen Hebrew Dataset (Hugging Face)
- **Source:** https://huggingface.co/datasets/DiffusionPen/DiffusionPen-Hebrew
- **Content:** 149,952 synthetic Hebrew handwriting line images with ground truth
- **Format:** Already line-level — ready to use directly with Kraken
- **Split:** train (119,986) / validation (14,855) / test (15,111)

---

## Workflow

### Step 1: Download datasets

```bash
# HHD dataset
wget https://www.cs.bgu.ac.il/~berat/data/hhd_dataset.zip
unzip hhd_dataset.zip -d data-prep/hhd/raw/

# DiffusionPen (via Hugging Face CLI)
pip install huggingface_hub
python data-prep/kraken/download_diffusionpen.py
```

### Step 2: Preprocess HHD into line-level pairs

```bash
python data-prep/kraken/preprocess_hhd.py \
  --input data-prep/hhd/raw/ \
  --output data-prep/hhd/lines/
```

This produces pairs of:
- `line_0001.png` — cropped line image
- `line_0001.gt.txt` — ground truth transcription

### Step 3: Train Kraken

```bash
# Install Kraken
pip install kraken

# Train on DiffusionPen (recommended starting point)
ketos train \
  -o models/hebrew_v1 \
  -t data-prep/diffusionpen/train/ \
  -e data-prep/diffusionpen/val/ \
  --load pretrained/arabic_best.mlmodel \
  --resize add \
  -r 0.0001 \
  --batch-size 16

# Or train on HHD after preprocessing
ketos train \
  -o models/hebrew_hhd_v1 \
  -t data-prep/hhd/lines/ \
  --resize add
```

### Step 4: Serve the model

Once trained, wrap the model in a FastAPI microservice and point `KRAKEN_API_URL`
at it from the Next.js app. The transcription route (`src/app/api/transcribe/route.ts`)
already has a placeholder for this integration.

---

## Recommended Pretrained Base Models

| Model | Language | Download |
|-------|----------|----------|
| `arabic_best.mlmodel` | Arabic (similar script) | `kraken get arabic_best` |
| `HTR-United-Manu_McFrench` | French manuscripts | `kraken get HTR-United-Manu_McFrench` |

Start from the Arabic model — the script similarity gives a significant head start.

---

## Notes

- The DiffusionPen dataset is synthetic. It bootstraps well but real HHD data
  will improve accuracy on actual manuscripts.
- Every correction made by users in the SeferSofer review interface is stored in
  the `word_corrections` table — this is your future fine-tuning dataset.
- Target: collect 1,000+ real corrected pages before fine-tuning.
