from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas, crud
from ..database import get_db

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/", response_model=schemas.DashboardResponse)
def dashboard(db: Session = Depends(get_db)):
    return crud.get_dashboard_stats(db)
