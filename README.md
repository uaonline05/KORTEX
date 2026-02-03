# KORTEX | Warspace Ecosystem

A professional-grade situational awareness platform for strategic operations and monitoring. This project is a technical showcase of high-end tactical interfaces, real-time data visualization, and secure multi-user environments.

## 🚀 Key Features

- **KORTEX Monitor:** A high-performance tactical map interface based on Leaflet.js.
  - **Dynamic Map Layers:** Support for Dark OPS, Topographic with relief, and Satellite Hybrid (ESRI) views.
  - **Tactical Intel Layers:** Simulated real-time rendering of defensive structures (trenches), military zones, and asset distribution.
  - **Advanced HUD:** Authentic military-grade UI with scanline effects, glassmorphism panels, and interactive controls.
- **Unified Portal:** Dashboard for multiple military products (Monitor, Vezha, Element, Target Hub).
- **Secure Backend:** FastAPI-powered API with JWT authentication and admin-controlled access.
- **Admin Command:** Dedicated tools for user approval and real-time asset management.

## 🛠 Tech Stack

- **Frontend:** Vanilla JavaScript, CSS3 (Glassmorphism), HTML5 Semantic.
- **Mapping:** Leaflet.js with custom tile layers (CartoDB, OpenTopoMap, ESRI).
- **Backend:** Python 3.10+, FastAPI, SQLAlchemy.
- **Database:** SQLite (SQLAlchemy ORM).
- **Security:** JWT Tokens, Bcrypt password hashing.

## 📦 Installation & Setup

### Backend
1. Navigate to `backend/`
2. Install dependencies: `pip install fastapi uvicorn sqlalchemy python-jose bcrypt`
3. Start server: `uvicorn main:app --reload`

### Frontend
1. Open `frontend/index.html` in any modern browser.
2. Default Admin Credentials: `admin` / `admin123`

## 🛡 Disclaimer
This project is for **demonstration and educational purposes only**. It showcases UI/UX capabilities for situational awareness systems and does not contain real classified data.

---
**Developed for specialized strategic monitoring showcases.**
