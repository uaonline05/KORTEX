import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import bcrypt

from database import SessionLocal, engine, User, Marker, init_db

# Security
SECRET_KEY = "tactical_secret_key_change_me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") # Removed passlib due to bcrypt 72 byte bug
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

app = FastAPI(title="KORTEX API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

@app.on_event("startup")
def startup():
    init_db()
    # Create default admin if not exists
    db = SessionLocal()
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        new_admin = User(
            username="admin", 
            hashed_password=get_password_hash("admin123"), 
            is_admin=True, 
            is_approved=True
        )
        db.add(new_admin)
        db.commit()
    db.close()

@app.post("/register")
def register(username: str, password: str, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = User(
        username=username,
        hashed_password=get_password_hash(password),
        is_approved=False # Waiting for admin
    )
    db.add(new_user)
    db.commit()
    return {"message": "Registration successful. Wait for administrator approval."}

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Account pending approval. Contact administrator.")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "is_admin": user.is_admin}

@app.get("/admin/pending", response_model=List[dict])
def get_pending_users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    users = db.query(User).filter(User.is_approved == False).all()
    return [{"id": u.id, "username": u.username} for u in users]

@app.post("/admin/approve/{user_id}")
def approve_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can access this")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_approved = True
    db.commit()
    return {"message": f"User {user.username} approved"}

@app.get("/markers")
def get_markers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    markers = db.query(Marker).all()
    result = []
    for m in markers:
        creator = db.query(User).filter(User.id == m.created_by).first()
        result.append({
            "id": m.id,
            "lat": m.lat,
            "lon": m.lon,
            "type": m.type,
            "label": m.label,
            "description": m.description,
            "created_at": m.created_at,
            "created_by": creator.username if creator else "Unknown"
        })
    return result

@app.post("/markers")
def add_marker(lat: float, lon: float, type: str, label: str, description: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_marker = Marker(lat=lat, lon=lon, type=type, label=label, description=description, created_by=current_user.id)
    db.add(new_marker)
    db.commit()
    return {"message": "Marker added"}
