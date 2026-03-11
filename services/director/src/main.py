from fastapi import FastAPI

app = FastAPI(title="Orion Director Service")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "director"}
