"""Fine-tune an open-weights coding model on your own Antillusion conversations (QLoRA).

Input : the JSONL exported from Antillusion (Settings → بيانات التدريب → تصدير JSONL). Each line is
        {"messages": [...], "tools": [...]} in the OpenAI chat format, including tool calls and tool results.
Output: a LoRA adapter folder you serve next to the base model (see serve.sh, LORA=...).

  pip install -r requirements.txt
  python train_lora.py --data antillusion-train.jsonl --out out/antillusion-lora

Needs a GPU. With 4-bit loading a 30B model trains on one 48 GB card; a 7B model on 16-24 GB.
A handful of examples only memorises them: aim for a few hundred good conversations before expecting a real change,
and add permissively licensed public data in the same format with --extra.
"""
import argparse
import json

import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, DataCollatorForLanguageModeling,
                          Trainer, TrainingArguments)


def load_examples(paths):
    for path in paths:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield json.loads(line)


def to_text(example, tokenizer):
    """Render one conversation with the model's own chat template (so tool calls use the format the model expects)."""
    messages = []
    for m in example["messages"]:
        m = {k: v for k, v in m.items() if v is not None}
        m.setdefault("content", "")
        if m.get("tool_calls"):
            calls = []
            for c in m["tool_calls"]:
                args = c["function"].get("arguments") or "{}"
                calls.append({"type": "function", "id": c.get("id"),
                              "function": {"name": c["function"]["name"], "arguments": json.loads(args) if isinstance(args, str) else args}})
            m["tool_calls"] = calls
        messages.append(m)
    return tokenizer.apply_chat_template(messages, tools=example.get("tools"), tokenize=False)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True, help="JSONL exported from Antillusion")
    p.add_argument("--extra", nargs="*", default=[], help="more JSONL files in the same format")
    p.add_argument("--base", default="Qwen/Qwen3-Coder-30B-A3B-Instruct")
    p.add_argument("--out", default="out/antillusion-lora")
    p.add_argument("--max-len", type=int, default=16384, help="longer conversations are skipped (raise it if you have the VRAM)")
    p.add_argument("--epochs", type=float, default=2)
    p.add_argument("--lr", type=float, default=1e-4)
    p.add_argument("--rank", type=int, default=16)
    args = p.parse_args()

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    rows, skipped_long, skipped_bad = [], 0, 0
    for ex in load_examples([args.data, *args.extra]):
        try:
            text = to_text(ex, tokenizer)
        except Exception:                      # malformed tool-call JSON, template mismatch…
            skipped_bad += 1
            continue
        ids = tokenizer(text, add_special_tokens=False)["input_ids"]
        if len(ids) > args.max_len:
            skipped_long += 1
            continue
        rows.append({"input_ids": ids, "attention_mask": [1] * len(ids)})
    print(f"{len(rows)} conversations to train on · skipped {skipped_long} too long, {skipped_bad} malformed")
    if len(rows) < 20:
        print("WARNING: fewer than 20 examples — the adapter will mostly memorise them. Collect more before relying on it.")
    if not rows:
        raise SystemExit("Nothing to train on.")

    model = AutoModelForCausalLM.from_pretrained(
        args.base, device_map="auto", torch_dtype=torch.bfloat16,
        quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True, bnb_4bit_compute_dtype=torch.bfloat16))
    model = prepare_model_for_kbit_training(model)
    model = get_peft_model(model, LoraConfig(r=args.rank, lora_alpha=args.rank * 2, lora_dropout=0.05, target_modules="all-linear", task_type="CAUSAL_LM"))
    model.print_trainable_parameters()

    trainer = Trainer(
        model=model,
        train_dataset=Dataset.from_list(rows),
        data_collator=DataCollatorForLanguageModeling(tokenizer, mlm=False),
        args=TrainingArguments(
            output_dir=args.out, num_train_epochs=args.epochs, learning_rate=args.lr, lr_scheduler_type="cosine", warmup_ratio=0.03,
            per_device_train_batch_size=1, gradient_accumulation_steps=8, bf16=True, gradient_checkpointing=True,
            logging_steps=5, save_strategy="epoch", save_total_limit=2, report_to="none"),
    )
    trainer.train()
    model.save_pretrained(args.out)
    tokenizer.save_pretrained(args.out)
    print(f"Adapter saved to {args.out}. Serve it with:  LORA={args.out} bash serve.sh")


if __name__ == "__main__":
    main()
