from fastapi import FastAPI

app = FastAPI(title="Orion Pulse Service")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pulse"}
