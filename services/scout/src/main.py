from fastapi import FastAPI

app = FastAPI(title="Orion Scout Service")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "scout"}
