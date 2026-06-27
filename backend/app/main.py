import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, Base
from .routers import products, customers, orders, dashboard

# Create tables on startup (fine for this project's scope;
# use Alembic migrations for a real production system)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Inventory & Order Management System",
    description="A simplified API for managing products, customers, orders, and inventory.",
    version="1.0.0",
)

# CORS - comma-separated list of allowed origins, configured via env var
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(dashboard.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Inventory & Order Management API"}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}
