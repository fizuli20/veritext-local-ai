# Local rewrite fine-tuning

These experiments fine-tune the text generator with QLoRA on Apple Silicon. They evaluate clarity, rewrite extent, and source preservation. Detector scores never enter training, checkpoint selection, or draft selection.

## Data and reproduction

Download `train.json`, `dev.json` and `test.json` from the [pinned IteraTeR release](https://huggingface.co/datasets/wanyu/IteraTeR_human_doc/tree/3b0bdabb090d04062ebc17e54ac889a64f5cb791) into a scratch directory. The files contain one JSON record per line. The dataset repository lists Apache-2.0. The underlying works can carry their own licenses.

`prepare.py` groups by original document across splits. It replays annotated edits only inside eligible excerpts, discards edits labeled as changing meaning or with unknown intent, and checks retained numbers, quotations, and selected qualifier words. With `--editorial-pairs`, training retains more substantial licensed edits and adds 26 original examples written for this project. The resulting 85 rows include each original example twice. The authored evaluation sets are kept out of training.

The first run used [MLX Qwen2.5 1.5B](https://huggingface.co/mlx-community/Qwen2.5-1.5B-Instruct-4bit/tree/8b403126fc14f14cfc99bb4cfa72ecbc129ea677). The local runtime used Python 3.13 and `mlx-lm==0.32.2`.

```sh
python3 scripts/rewriter-training/prepare.py RAW_DIR DATA_DIR \
  --editorial-pairs scripts/rewriter-training/editorial-pairs.tsv

mlx_lm.lora --config scripts/rewriter-training/full.yaml \
  --model BASE_DIR --train --data DATA_DIR --adapter-path ADAPTER_DIR \
  --mask-prompt --num-layers 12 --batch-size 1 --max-seq-length 640 \
  --iters 95 --learning-rate 0.0001 --seed 42 --steps-per-report 10 \
  --steps-per-eval 30 --val-batches 11 --save-every 30 --grad-checkpoint

python scripts/rewriter-training/evaluate.py BASE_DIR SELECTED_ADAPTER_DIR \
  DATA_DIR/test.jsonl results.json --full-rewrite \
  --probes scripts/rewriter-training/full-probes.json
```

The first pilot can be reproduced by omitting `--editorial-pairs` and `--config`, setting `--iters 120`, `--steps-per-eval 40` and `--save-every 40`, and using the default evaluation prompt and probes. The second pilot selected checkpoint 60 by validation loss. Use `--first-adapter` to compare both under one prompt. See the [recorded results](../../docs/validation/rewriter-fine-tuning.json). The number and quote checks are literal, and exact qualifier vocabulary does not establish preserved meaning.

## Qwen3 4B trial

The later run used [MLX Qwen3-4B-Instruct-2507](https://huggingface.co/mlx-community/Qwen3-4B-Instruct-2507-4bit/tree/50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b). Use the same prepared dataset and training command with `--iters 60` and `--learning-rate 0.000025`. The final checkpoint had the lowest validation loss. Evaluate with `--full-rewrite --probes-only --base-revision 50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b --probes scripts/rewriter-training/qwen3-probes.json`. The library paragraph is a repeat comparison; summary counts exclude it.

## Connect a trained adapter to Veritext

Use the saved adapter directory containing `adapter_config.json` and `adapters.safetensors`. The local helper can download the matching pinned base or reuse an existing model via `--base`.

```sh
uv run --python 3.13 --with mlx-lm==0.32.2 \
  python scripts/rewriter-training/serve.py ADAPTER_DIR
```

In **Model settings**, set **Local server address** to `http://127.0.0.1:18715/v1`, then select **Connect** and **Return to editor**. Rewrite requests go to the loopback server. The deployed site may ask the browser for local network access. Veritext can also be opened on localhost. For the Qwen3 adapter, pass `--base-model qwen3-4b` to the helper. Use `--port` if a different local server is already using the default port.
