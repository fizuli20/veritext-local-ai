"""Serve a tested Veritext adapter on this Mac through a loopback endpoint."""

import argparse
from pathlib import Path
import runpy
import sys

from huggingface_hub import snapshot_download

BASE_MODELS = {
    "qwen2.5-1.5b": (
        "mlx-community/Qwen2.5-1.5B-Instruct-4bit",
        "8b403126fc14f14cfc99bb4cfa72ecbc129ea677",
    ),
    "qwen3-4b": (
        "mlx-community/Qwen3-4B-Instruct-2507-4bit",
        "50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b",
    ),
}
BASE_FILES = [
    "config.json",
    "chat_template.jinja",
    "generation_config.json",
    "model.safetensors",
    "model.safetensors.index.json",
    "tokenizer.json",
    "tokenizer_config.json",
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("adapter", type=Path)
    parser.add_argument("--base", type=Path, help="Use an already downloaded MLX base model.")
    parser.add_argument("--base-model", choices=BASE_MODELS, default="qwen2.5-1.5b")
    parser.add_argument("--port", type=int, default=18715)
    args = parser.parse_args()
    adapter = args.adapter.resolve(strict=True)
    for name in ("adapter_config.json", "adapters.safetensors"):
        if not (adapter / name).is_file():
            parser.error(f"Adapter directory is missing {name}.")
    model_id, revision = BASE_MODELS[args.base_model]
    base = args.base or Path(snapshot_download(
        model_id, revision=revision, allow_patterns=BASE_FILES,
    ))
    sys.argv = [
        "mlx_lm.server", "--model", str(base), "--adapter-path", str(adapter),
        "--host", "127.0.0.1", "--port", str(args.port),
        "--allowed-origins",
        "http://127.0.0.1:3000,http://localhost:3000,https://veritext-local-ai.vercel.app",
    ]
    runpy.run_module("mlx_lm.server", run_name="__main__")


if __name__ == "__main__":
    main()
