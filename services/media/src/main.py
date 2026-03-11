from fastapi import FastAPI

app = FastAPI(title="Orion Media Service")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "media"}
