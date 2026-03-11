from fastapi import FastAPI

app = FastAPI(title="Orion Editor Service")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "editor"}
