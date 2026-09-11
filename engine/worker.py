"""Private JSON-lines subprocess. No HTTP listener; stdout is protocol only."""
import json
import sys
import time
import traceback

sys.stdout.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")
model = None
model_key = None


def emit(data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def handle(req):
    global model, model_key
    from faster_whisper import WhisperModel
    if req["command"] == "check":
        import importlib.metadata
        return {"version": importlib.metadata.version("faster-whisper"), "python": sys.version.split()[0]}
    settings = req["settings"]
    key = (settings["model"], settings["device"])
    if key != model_key:
        emit({"id": req["id"], "event": "status", "message": "正在加载模型；首次使用将下载模型，请保持网络连接…"})
        # Release the previous model before allocating a larger one.
        model = None
        model_key = None
        model = WhisperModel(key[0], device=key[1], compute_type="int8" if key[1] == "cpu" else "float16", download_root=req["cache"], local_files_only=settings.get("offline", False))
        model_key = key
    if req["command"] == "load":
        return {"model": key[0], "device": key[1]}
    started = time.monotonic()
    emit({"id": req["id"], "event": "status", "message": "正在识别语音…"})
    segments, info = model.transcribe(req["path"], language=None if settings["language"] == "auto" else settings["language"], beam_size=5, vad_filter=True, condition_on_previous_text=False)
    output = []
    for segment in segments:
        item = {"start": segment.start, "end": segment.end, "text": segment.text.strip()}
        output.append(item)
        emit({"id": req["id"], "event": "segment", "segment": item})
    return {"text": "\n".join(s["text"] for s in output), "segments": output, "language": info.language, "duration": info.duration, "elapsed": round(time.monotonic() - started, 2), "model": key[0], "device": key[1]}


for line in sys.stdin:
    req = {}
    try:
        req = json.loads(line)
        emit({"id": req["id"], "result": handle(req)})
    except Exception as exc:
        traceback.print_exc(file=sys.stderr)
        emit({"id": req.get("id"), "error": f"{type(exc).__name__}: {exc}"})
