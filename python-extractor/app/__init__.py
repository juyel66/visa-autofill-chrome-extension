"""Local Passport Extraction Service Proof of Concept."""
import sys

# On Windows environments with Application Control (WDAC/AppLocker), loading compiled
# optional C-extension DLLs (such as ujson) may be blocked. Setting sys.modules['ujson'] = None
# ensures FastAPI/Starlette safely treats it as absent (catching ModuleNotFoundError)
# rather than throwing an unhandled AppLocker ImportError on startup.
if "ujson" not in sys.modules:
    try:
        import ujson  # noqa: F401
    except Exception:
        sys.modules["ujson"] = None
