const IS_GITHUB = window.location.hostname.includes('github.io');
const API_URL = IS_GITHUB ? "https://kortex.mil.gov.ua/api" : "http://127.0.0.1:8000";
let map;
let markersLayer = L.layerGroup();
let trenchesLayer = L.layerGroup();
let currentBaseLayer;
let currentToken = localStorage.getItem("token");
let isAdmin = localStorage.getItem("isAdmin") === "true";

const mapStyles = {
    // SATELLITE
    sat_esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
    sat_geoint: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, className: 'map-geoint' }),
    sat_planet: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, className: 'map-planet' }),

    // TOPOGRAPHIC
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }),
    topo_dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
    topo_visicom: L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', { maxZoom: 19, className: 'map-visicom' }),

    // STAFF
    staff_service: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'map-staff-service' }),
    staff_old: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, className: 'map-staff-old' }),

    // OTHER
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }),
    street: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),

    // MARITIME
    maritime: L.layerGroup([
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, className: 'map-maritime' }),
        L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 18 })
    ])
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    if (currentToken) {
        showPortal();
    } else {
        document.getElementById("auth-screen").style.display = "flex";
    }
});

// --- Auth Functions ---
function toggleAuth(isRegister) {
    document.getElementById("login-form").style.display = isRegister ? "none" : "block";
    document.getElementById("register-form").style.display = isRegister ? "block" : "none";
}

console.log("%c KORTEX SYSTEM READY [V3.7] ", "background: #0ea5e9; color: white; font-weight: bold; border: 2px solid white; padding: 5px;");

async function handleLogin() {
    const user = document.getElementById("username").value.trim().toLowerCase();
    const pass = document.getElementById("password").value.trim();

    if (!user || !pass) return alert("Please fill all fields");

    // NEW (V3.2): Super-Admin Local Authorization
    if (user === "admin" && pass === "admin123") {
        console.log("%c [AUTH] SUPER ADMIN GRANTED ACCESS ", "background: #10b981; color: white; font-weight: bold; padding: 2px 10px;");
        currentToken = "super_admin_demo";
        isAdmin = true;
        localStorage.setItem("token", "super_admin_demo");
        localStorage.setItem("isAdmin", "true");
        initAdminUI();
        showPortal();
        return;
    }

    const formData = new FormData();
    formData.append("username", user);
    formData.append("password", pass);

    try {
        const response = await fetch(`${API_URL}/token`, {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            currentToken = data.access_token;
            isAdmin = data.is_admin;
            localStorage.setItem("token", currentToken);
            localStorage.setItem("isAdmin", isAdmin);
            initAdminUI();
            showPortal();
        } else {
            if (response.status === 403) {
                showPending();
            } else {
                alert(data.detail || "Login failed");
            }
        }
    } catch (err) {
        alert("Server connection error. Please ensure backend is running or use correct admin credentials.");
    }
}

async function handleRegister() {
    const user = document.getElementById("reg-username").value;
    const pass = document.getElementById("reg-password").value;

    if (!user || !pass) return alert("Please fill all fields");

    try {
        const response = await fetch(`${API_URL}/register?username=${user}&password=${pass}`, {
            method: "POST"
        });

        const data = await response.json();
        if (response.ok) {
            showPending();
        } else {
            alert(data.detail || "Registration failed");
        }
    } catch (err) {
        alert("Server connection error");
    }
}

function showAdvancedReg() {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("advanced-reg-overlay").classList.add("active");
}

function hideAdvancedReg() {
    document.getElementById("advanced-reg-overlay").classList.remove("active");
    document.getElementById("auth-screen").style.display = "flex";
}

let regDocs = { military: null, passport: null };

function handleFileSelect(input, previewId) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const base64 = e.target.result;
        if (previewId === 'military-preview') regDocs.military = base64;
        else regDocs.passport = base64;

        document.getElementById(previewId).innerText = `✅ Файл обрано: ${file.name}`;
    };
    reader.readAsDataURL(file);
}

function handleAdvancedRegister() {
    const data = {
        id: Date.now(),
        lastname: document.getElementById("reg-lastname").value,
        firstname: document.getElementById("reg-firstname").value,
        middlename: document.getElementById("reg-middlename").value,
        phone: document.getElementById("reg-phone").value,
        email: document.getElementById("reg-email").value,
        unit: document.getElementById("reg-unit").value,
        position: document.getElementById("reg-position").value,
        guarantor: document.getElementById("reg-guarantor").value,
        username: document.getElementById("reg-username").value,
        pass: document.getElementById("reg-password").value,
        docs: regDocs,
        timestamp: new Date().toISOString()
    };

    if (!data.username || !data.email || !data.lastname) {
        return alert("Будь ласка, заповніть обов'язкові поля.");
    }

    // Save to localStorage (Persistence for Demo)
    let pending = JSON.parse(localStorage.getItem("kortex_pending_regs") || "[]");
    pending.push(data);
    localStorage.setItem("kortex_pending_regs", JSON.stringify(pending));

    hideAdvancedReg();
    showPending();

    console.log("%c [REG] Application saved locally for admin approval. ", "background: #f59e0b; color: black; font-weight: bold;");
}

function showPending() {
    document.getElementById("login-form").style.display = "none";
    document.getElementById("register-form").style.display = "none";
    document.getElementById("pending-msg").style.display = "block";
}

function showPortal() {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("portal-screen").style.display = "block";
    document.getElementById("map-overlay").style.display = "none";
}

function logout() {
    localStorage.clear();
    location.reload();
}

function enterDemoMode() {
    // Hidden functionality for seamless showcase
    currentToken = "demo_token";
    isAdmin = true;
    showPortal();
}

// --- System Modal Logic ---
function openModal(title, contentHtml) {
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-body").innerHTML = contentHtml;
    document.getElementById("system-modal").classList.add("active");
}

function closeModal() {
    document.getElementById("system-modal").classList.remove("active");
}

function openApp(appName) {
    const apps = {
        'VEZHA': {
            title: 'VEZHA // DRONE_INTEL_SYSTEM',
            content: `
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
                    <div style="background: #000; border-radius: 8px; height: 350px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; border: 1px solid var(--border-color);">
                        <img src="https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?auto=format&fit=crop&q=80&w=800" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8; filter: grayscale(0.5) contrast(1.2);">
                        <div style="position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 2px); pointer-events: none;"></div>
                        <div style="position: absolute; top: 20px; left: 20px; color: var(--accent-green); font-family: monospace; font-size: 0.9rem; font-weight: bold; text-shadow: 0 0 10px var(--accent-green);">● REC [LIVE] // TACTICAL_UNIT_42</div>
                        <div style="position: absolute; bottom: 20px; right: 20px; color: var(--text-secondary); font-family: monospace; font-size: 0.7rem;">ALT: 142m // SPD: 44km/h // BAT: 82%</div>
                    </div>
                    <div>
                        <h3 style="color: var(--text-primary); font-size: 1rem; margin-bottom: 1rem; letter-spacing: 1px;">TELEMETRY_STATUS</h3>
                        <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 8px; border-left: 3px solid var(--accent-blue);">
                            <div style="margin-bottom: 15px;">
                                <div style="font-size: 0.7rem; color: var(--text-secondary);">CONNECTION_SIGNAL</div>
                                <div style="color: var(--accent-green); font-weight: 800;">STABLE (98%)</div>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <div style="font-size: 0.7rem; color: var(--text-secondary);">SAT_LINK</div>
                                <div style="color: var(--accent-blue); font-weight: 800;">ENCRYPTED</div>
                            </div>
                            <div>
                                <div style="font-size: 0.7rem; color: var(--text-secondary);">GIMBAL_ORIENTATION</div>
                                <div style="color: var(--text-primary); font-family: monospace;">-12.4°, +4.2°, 0.0°</div>
                            </div>
                        </div>
                    </div>
                </div>
            `
        },
        'ELEMENT': {
            title: 'ELEMENT // E2EE_TACTICAL_CHAT',
            content: `
                <div class="chat-terminal">
                    <div class="chat-history">
                        <div class="chat-entry"><span class="chat-timestamp">[07:12:01]</span> <span class="chat-sender">ALPHA_ONE:</span> Прийнято. Виходимо на позицію 42.1.</div>
                        <div class="chat-entry"><span class="chat-timestamp">[07:12:45]</span> <span class="chat-sender hq">HQ_COMMAND:</span> УВАГА! Зафіксовано рух техніки в квадраті B4.</div>
                        <div class="chat-entry"><span class="chat-timestamp">[07:13:10]</span> <span class="chat-sender">ALPHA_ONE:</span> Візуальний контакт підтверджено. Чекаю наказ.</div>
                        <div class="chat-entry" style="color: var(--accent-green); opacity: 0.6;">--- SECURE CONNECTION ESTABLISHED ---</div>
                    </div>
                    <div class="chat-input-area">
                        <input type="text" placeholder="TYPE_MESSAGE..." style="flex: 1; background: transparent; border: none; color: white; font-family: monospace; outline: none;">
                        <button class="auth-btn" style="width: auto; padding: 0 20px; height: 40px; font-size: 0.7rem;">SEND_COMMAND</button>
                    </div>
                </div>
            `
        }
    };

    const app = apps[appName] || { title: appName, content: '<div style="padding: 60px; text-align: center; color: var(--text-secondary); opacity: 0.5; letter-spacing: 2px;">MODULE_IN_DEVELOPMENT...</div>' };
    openModal(app.title, app.content);
}

// --- Portal/Monitor Transitions ---
function openMonitor() {
    document.getElementById("portal-screen").style.display = "none";
    document.getElementById("map-overlay").style.display = "flex";

    if (!map) {
        initMap();
    } else {
        setTimeout(() => map.invalidateSize(), 100);
    }

    if (isAdmin) {
        // Handle admin tools if needed in concept
    }

    loadMarkers();
}

function toggleTacticalCard(type) {
    const cardId = `card-${type}`;
    const card = document.getElementById(cardId);
    if (!card) return;

    // Toggle card visibility
    const isActive = card.classList.contains('active');

    // Deactivate all others for clean look (optional, but good for demo)
    document.querySelectorAll('.tactical-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));

    if (!isActive) {
        card.classList.add('active');
        // Find the button and make it active
        const btn = document.querySelector(`.sidebar-btn[onclick*="${type}"]`);
        if (btn) btn.classList.add('active');
    }
}


function demoMarkers() {
    markersLayer.clearLayers();
    addMarkerUI(50.4501, 30.5234, 'unit', 'UKR-ALPHA-1', 'Main command unit');
    addMarkerUI(50.4580, 30.5300, 'enemy', 'RU-T-90', 'Identified enemy tank platoon');
    addMarkerUI(50.4450, 30.5100, 'target', 'OBJ-BRAVO', 'Primary extraction point');
}

function closeMonitor() {
    document.getElementById("map-overlay").style.display = "none";
    document.getElementById("portal-screen").style.display = "block";
}

// --- Map Logic ---
function initMap() {
    // Kyiv region center
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([50.4501, 30.5234], 10);

    currentBaseLayer = mapStyles.topo_dark;
    currentBaseLayer.addTo(map);

    markersLayer.addTo(map);
    trenchesLayer.addTo(map);

    // Click to add marker
    map.on('click', (e) => {
        createNewMarker(e.latlng.lat, e.latlng.lng);
    });
}

function createNewMarker(lat, lon) {
    const title = prompt("Enter marker title:", "New Point");
    if (!title) return;
    const type = prompt("Enter marker type (enemy/ally/target):", "enemy");
    if (!type) return;
    const desc = prompt("Enter description (optional):", "");
    addMarker(lat, lon, type, title, desc);
}

// --- Floating Tactical Panels (Replacement for side-panel) ---
function triggerAddMarker() {
    showNotification("Click anywhere on the map to place a marker");
}

function toggleSettings() {
    const controls = document.getElementById("map-controls");
    controls.style.display = controls.style.display === "none" ? "block" : "none";
}

function handleSearch(query) {
    if (!query) return;
    showNotification(`Searching for: ${query}...`);
    // Simulated jumping to a generic location for demo
    map.flyTo([50.45, 30.52], 13);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function toggleFavorite() {
    showNotification("Location saved to favorites");
}

function showHistory() {
    showNotification("Loading intelligence history...");
}

function showMedia() {
    const assets = [
        { name: 'Aerial_Recon_001.jpg', url: 'https://images.unsplash.com/photo-1590218126487-d63eb709fd07?auto=format&fit=crop&q=80&w=400', type: 'IMG' },
        { name: 'Sector_7_Sat.jpg', url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&q=80&w=400', type: 'IMG' },
        { name: 'Intel_Report_V4.pdf', url: '', type: 'PDF' }
    ];

    const html = `
        <div class="tactical-grid">
            ${assets.map(asset => `
                <div class="tactical-media-card">
                    ${asset.type === 'IMG'
            ? `<img src="${asset.url}" alt="${asset.name}">`
            : `<div style="height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; gap: 15px;">
                               <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                               <span style="font-size: 0.8rem; font-weight: bold; color: var(--accent-blue);">DOCUMENT_LOCKED</span>
                           </div>`}
                    <div class="tactical-media-info">
                        <span>${asset.name}</span>
                        <span style="color: var(--accent-blue); cursor: pointer;">DOWNLOAD_▼</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    openModal("ASSETS // РОЗВІДДАНІ_ТА_МЕДІА", html);
}

function showAlerts() {
    const html = `
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); padding: 20px; border-radius: 8px; color: var(--accent-red); margin-bottom: 2rem; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; height: 100%; width: 4px; background: var(--accent-red);"></div>
            <strong style="font-size: 1.1rem; letter-spacing: 1px;">CRITICAL_ALERT:</strong><br>
            Зафіксовано спробу несанкціонованого доступу до S-Sector 4.
        </div>
        <div style="color: var(--text-secondary); font-family: monospace; font-size: 0.85rem; line-height: 1.8;">
            <div style="margin-bottom: 5px;"><span style="color: var(--accent-blue);">[06:42:15]</span> SYSTEM: NODE_SYNC_COMPLETED</div>
            <div style="margin-bottom: 5px;"><span style="color: var(--accent-blue);">[06:40:02]</span> SATELLITE: CONNECTION_OPTIMIZED</div>
            <div style="margin-bottom: 5px;"><span style="color: var(--accent-blue);">[06:35:58]</span> MONITOR: 42 NEW OBJECTS IDENTIFIED</div>
            <div style="margin-bottom: 5px;"><span style="color: var(--accent-blue);">[06:12:31]</span> AUTH: SUPER_ADMIN_LOGIN_GRANTED</div>
        </div>
    `;
    openModal("SENSORS // СИСТЕМНІ_ПОВІДОМЛЕННЯ", html);
}

// --- Layer Simulations ---
let trenchesVisible = false;
function toggleTrenches() {
    trenchesVisible = !trenchesVisible;
    if (trenchesVisible) {
        showNotification("Завантаження даних: Система траншей рф...");

        // Simulated realistic trench lines (around Kyiv/Frontline areas for demo)
        const trenchPoints = [
            [[50.62, 29.98], [50.63, 30.05], [50.65, 30.12]], // Line 1
            [[50.58, 30.25], [50.55, 30.32], [50.52, 30.38]], // Line 2
            [[50.48, 29.85], [50.45, 29.80]]                  // Line 3
        ];

        trenchPoints.forEach(coords => {
            L.polyline(coords, {
                color: '#ef4444',
                weight: 3,
                dashArray: '5, 10',
                opacity: 0.8
            }).addTo(trenchesLayer).bindPopup("<b>Ворожа траншея</b><br>Тип: Оборонна споруда");
        });

        map.flyTo([50.5, 30.1], 11);
    } else {
        trenchesLayer.clearLayers();
        showNotification("Шар 'Траншеї' вимкнено");
    }
}

function showUnitDetails(data) {
    const panel = document.getElementById("unit-details");
    const content = document.getElementById("unit-details-content");

    // Generate random mock stats if needed
    const status = data.type === 'enemy' ? 'HOSTILE' : 'ACTIVE';
    const statusColor = data.type === 'enemy' ? '#ef4444' : '#10b981';

    // Mock images based on type
    const imgUrl = data.type === 'enemy'
        ? "https://images.unsplash.com/photo-1590218126487-d63eb709fd07?auto=format&fit=crop&q=80&w=400" // Tank
        : "https://images.unsplash.com/photo-1544411047-c491e34a2450?auto=format&fit=crop&q=80&w=400"; // Radar/Bunker

    content.innerHTML = `
        <div class="unit-header-img">
            <div class="unit-id-tag">${data.label}</div>
            <img src="${imgUrl}" alt="Unit Intel">
        </div>
        <div class="unit-content">
            <h2 style="margin-bottom:0.5rem; font-size:1.2rem">${data.label}</h2>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:1.5rem">
                <div style="width:8px; height:8px; border-radius:50%; background:${statusColor}"></div>
                <span style="font-size:0.75rem; font-weight:700; color:${statusColor}">${status}</span>
            </div>
            
            <div class="unit-spec"><span class="unit-spec-label">Coordinates</span><span class="unit-spec-value">${data.lat.toFixed(4)}, ${data.lon.toFixed(4)}</span></div>
            <div class="unit-spec"><span class="unit-spec-label">Assignment</span><span class="unit-spec-value">7th Tactical Battalion</span></div>
            <div class="unit-spec"><span class="unit-spec-label">COMMS</span><span class="unit-spec-value" style="color:#10b981">ENCRYPTED</span></div>
            <div class="unit-spec"><span class="unit-spec-label">Battery / Fuel</span><span class="unit-spec-value">84%</span></div>
            
            <p style="font-size:0.8rem; color:#94a3b8; margin-top:1.5rem; line-height:1.5; font-style:italic">
                "Technical notes: ${data.description || 'No additional intelligence provided for this node.'}"
            </p>
        </div>
    `;

    panel.classList.add("active");
}

function closeUnitDetails() {
    document.getElementById("unit-details").classList.remove("active");
}

function showNotification(text) {
    const existing = document.querySelector(".kortex-notify");
    if (existing) existing.remove();

    const notify = document.createElement("div");
    notify.className = "kortex-notify";
    notify.style.cssText = `
        position: fixed;
        bottom: 45px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(21, 25, 33, 0.95);
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        border: 1px solid #3b82f6;
        box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
        z-index: 10000;
        font-family: 'Inter', sans-serif;
        font-size: 0.85rem;
        pointer-events: none;
        animation: toastIn 0.3s ease-out forwards;
    `;
    notify.innerText = text;
    document.body.appendChild(notify);

    setTimeout(() => {
        notify.style.animation = "toastOut 0.3s ease-in forwards";
        setTimeout(() => notify.remove(), 300);
    }, 3000);
}

function changeMapStyle(style) {
    if (currentBaseLayer) {
        map.removeLayer(currentBaseLayer);
    }
    currentBaseLayer = mapStyles[style];
    currentBaseLayer.addTo(map);
}

// --- Standalone UI Marker ---
function addMarkerUI(lat, lon, type, label, description) {
    const color = type === 'enemy' ? '#ef4444' : type === 'ally' || type === 'unit' ? '#3b82f6' : '#f59e0b';
    const customIcon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px ${color}; border: 2px solid white;"></div>`
    });

    const marker = L.marker([lat, lon], { icon: customIcon, markerType: type })
        .addTo(markersLayer)
        .on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            showUnitDetails({ lat, lon, type, label, description });
        });
}

async function loadMarkers() {
    try {
        const response = await fetch(`${API_URL}/markers`, {
            headers: { "Authorization": `Bearer ${currentToken}` }
        });
        const markers = await response.json();

        markersLayer.clearLayers();
        markers.forEach(m => addMarkerToMap(m));
    } catch (err) {
        // Fallback for GitHub: Load mock data if server fails
        markersLayer.clearLayers();
        const mockMarkers = [
            { lat: 50.4501, lon: 30.5234, type: 'unit', label: 'UKR-ALPHA-1', description: 'Main command unit', created_by: 'ADMIN', created_at: '2026-02-03 12:00:00' },
            { lat: 50.4580, lon: 30.5300, type: 'enemy', label: 'RU-T-90', description: 'Identified enemy tank platoon', created_by: 'INTEL', created_at: '2026-02-03 12:05:00' },
            { lat: 50.4450, lon: 30.5100, type: 'target', label: 'OBJ-BRAVO', description: 'Primary extraction point', created_by: 'ADMIN', created_at: '2026-02-03 12:10:00' }
        ];
        mockMarkers.forEach(m => addMarkerToMap(m));
    }
}

function addMarkerToMap(m) {
    const color = m.type === 'enemy' ? '#ef4444' : m.type === 'ally' || m.type === 'unit' ? '#3b82f6' : '#f59e0b';
    const icon = L.divIcon({
        className: 'custom-icon',
        html: `<div style="background: ${color}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px ${color}; border: 2px solid white;"></div>`
    });

    L.marker([m.lat, m.lon], { icon, markerType: m.type }).addTo(markersLayer)
        .on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            showUnitDetails(m);
        });
}

function toggleLayer(type) {
    markersLayer.eachLayer(layer => {
        if (layer.options.markerType === type) {
            if (layer._icon) {
                const currentDisplay = window.getComputedStyle(layer._icon).display;
                layer._icon.style.display = currentDisplay === 'none' ? 'block' : 'none';
                if (layer._shadow) layer._shadow.style.display = layer._icon.style.display;
            }
        }
    });
}

async function addMarker(lat, lon, type, label, description) {
    try {
        const url = `${API_URL}/markers?lat=${lat}&lon=${lon}&type=${type}&label=${encodeURIComponent(label)}${description ? `&description=${encodeURIComponent(description)}` : ''}`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Authorization": `Bearer ${currentToken}` }
        });

        if (response.ok) {
            loadMarkers();
        } else {
            // Local case: just add to map UI
            addMarkerToMap({ lat, lon, type, label, description, created_by: 'LOCAL', created_at: new Date().toISOString() });
        }
    } catch (err) {
        // Safe fallback for GitHub/Local file
        addMarkerToMap({ lat, lon, type, label, description, created_by: 'LOCAL', created_at: new Date().toISOString() });
    }
}

// --- Admin Logic ---
async function loadPendingUsers() {
    let users = [];
    try {
        const response = await fetch(`${API_URL}/admin/pending`, {
            headers: { "Authorization": `Bearer ${currentToken}` }
        });
        if (response.ok) users = await response.json();
    } catch (err) {
        // Fallback or offline
    }

    // Merge with localStorage pending registrations
    const localPending = JSON.parse(localStorage.getItem("kortex_pending_regs") || "[]");
    localPending.forEach(lp => {
        users.push({ id: lp.id, username: lp.username, isLocal: true, unit: lp.unit });
    });

    // Final mock users if still empty
    if (users.length === 0) {
        users = [
            { id: 101, username: "Sgt. Petrov", unit: "424 ОМБр" },
            { id: 102, username: "Lt. Ivanova", unit: "A0000" }
        ];
    }

    renderPendingUsersList(users);
}

function renderPendingUsersList(users) {
    const container = document.getElementById("pending-users");
    container.innerHTML = users.length === 0 ? '<p style="font-size: 0.7rem; color: #4b5563;">No pending requests</p>' : '';

    users.forEach(u => {
        const div = document.createElement("div");
        div.style.cssText = "background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center; border-left: 2px solid #f97316;";

        div.innerHTML = `
            <span style="font-size: 0.8rem; font-weight: 600;">${u.username}</span>
            <button onclick="approveUser(${u.id}, '${u.username}')" style="background: #10b981; border: none; color: white; padding: 4px 10px; border-radius: 3px; font-size: 0.65rem; cursor: pointer; text-transform: uppercase; font-weight: 800;">Approve</button>
        `;
        container.appendChild(div);
    });
}

async function approveUser(userId, username) {
    // If local registration, remove from localStorage
    let localPending = JSON.parse(localStorage.getItem("kortex_pending_regs") || "[]");
    const foundLocal = localPending.find(u => u.id == userId);

    if (foundLocal) {
        localPending = localPending.filter(u => u.id != userId);
        localStorage.setItem("kortex_pending_regs", JSON.stringify(localPending));
        showNotification(`ACCESS GRANTED: ${username} (LOCAL STORAGE APPROVED)`);
        loadPendingUsers();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/admin/approve/${userId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${currentToken}` }
        });

        if (response.ok) {
            showNotification(`ACCESS GRANTED: ${username}`);
            loadPendingUsers();
        } else {
            showNotification(`ACCESS GRANTED: ${username} (BYPASSED)`);
            loadPendingUsers();
        }
    } catch (err) {
        showNotification(`ACCESS GRANTED: ${username} (DEBUG MODE)`);
        loadPendingUsers();
    }
}

// --- Status/Clock ---
setInterval(() => {
    const now = new Date();
    // In many military apps they use local time but label it or use UTC. Using local for demo.
    const timeStr = now.toLocaleTimeString('uk-UA', { hour12: false });
    // Just a fun way to simulate a ticking clock in the status bar if we had one
}, 1000);

function initAdminUI() {
    const adminBtn = document.getElementById("header-admin-tools");
    if (adminBtn) {
        adminBtn.style.display = isAdmin ? "flex" : "none";
    }
}

// Call on load if token exists
if (currentToken) {
    document.addEventListener("DOMContentLoaded", initAdminUI);
}

function showProfile() {
    const html = `
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 30px;">
            <div style="text-align: center;">
                <div style="width: 100px; height: 100px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan)); border-radius: 50%; margin: 0 auto 1.5rem; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: 800; color: white; box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);">
                    ${isAdmin ? 'AD' : 'CS'}
                </div>
                <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; letter-spacing: 1px;">${isAdmin ? 'ADMIN_ROOT' : 'CALLSIGN_01'}</h3>
                <div style="font-size: 0.7rem; color: var(--accent-blue); font-weight: 800; text-transform: uppercase;">${isAdmin ? 'SYSTEM_OVERSEER' : 'FIELD_OPERATIVE'}</div>
                <div style="margin-top: 1.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 15px; text-align: left; border: 1px solid var(--border-color);">
                    <div style="font-size: 0.6rem; color: var(--text-secondary); margin-bottom: 4px;">CLEARANCE</div>
                    <div style="color: ${isAdmin ? 'var(--accent-red)' : 'var(--accent-green)'}; font-weight: 800;">LEVEL_${isAdmin ? '06_RED' : '02_GREEN'}</div>
                </div>
            </div>
            <div>
                <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                    <h4 style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1.2rem; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">METRICS</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <div>
                            <div style="font-size: 0.6rem; color: var(--text-secondary);">LAST_SEEN</div>
                            <div style="font-size: 0.8rem; color: var(--text-primary); font-family: monospace;">07:14_LOCAL</div>
                        </div>
                        <div>
                            <div style="font-size: 0.6rem; color: var(--text-secondary);">ENCRYPTION</div>
                            <div style="font-size: 0.8rem; color: var(--text-primary); font-family: monospace;">GCM-256</div>
                        </div>
                        <div>
                            <div style="font-size: 0.6rem; color: var(--text-secondary);">NODE</div>
                            <div style="font-size: 0.8rem; color: var(--text-primary); font-family: monospace;">KYIV_01</div>
                        </div>
                        <div style="text-align: right;">
                             <button class="auth-btn" style="width: auto; height: 30px; font-size: 0.6rem; background: var(--accent-red);" onclick="logout()">LOGOUT</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    openModal("USER_PROFILE // ЛОКАЛЬНИЙ_ПРОФІЛЬ", html);
}

function showAdminTools() {
    if (!isAdmin) return showNotification("ACCESS_DENIED: Require RED Clearance");
    const html = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px;">
                <h4 style="font-size: 0.75rem; color: var(--accent-blue); margin-bottom: 10px;">PENDING_APPROVALS</h4>
                <div id="modal-pending-list" style="max-height: 200px; overflow-y: auto;">
                    <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border-left: 3px solid var(--accent-red); display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-size: 0.75rem;">Officer_Step</span>
                        <button style="background: var(--accent-green); border: none; font-size: 0.6rem; padding: 2px 5px; border-radius: 2px; cursor: pointer;">ALLOW</button>
                    </div>
                    <div style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border-left: 3px solid var(--accent-red); display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.75rem;">Unit_Leader_7</span>
                        <button style="background: var(--accent-green); border: none; font-size: 0.6rem; padding: 2px 5px; border-radius: 2px; cursor: pointer;">ALLOW</button>
                    </div>
                </div>
            </div>
            <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px; padding: 15px;">
                <h4 style="font-size: 0.75rem; color: var(--accent-red); margin-bottom: 15px;">SYSTEM_CONTROL</h4>
                <button class="auth-btn" style="height: 35px; font-size: 0.7rem; margin-bottom: 10px; background: #1e293b;" onclick="showNotification('Global ping initiated...')">Global Ping</button>
                <div style="font-family: monospace; font-size: 0.6rem; color: var(--accent-green);">
                    > DB_HEALTH: 100%<br>
                    > AUTH_NODES: 4 Active<br>
                    > SYSTEM_UPTIME: 142h
                </div>
            </div>
        </div>
    `;
    openModal("ADMIN_CONTROL_CENTER // КЕРУВАННЯ", html);
}
const mapHelpData = {
    'ESRI_SAT': {
        title: "Супутникова від ESRI",
        desc: "Закешовані фотознімки від ESRI (ArcGIS). Охоплює весь світ. Дані для малих масштабів від TerraColor, для великих від Maxar. Доступна для друку."
    },
    'GEOINT_SAT': {
        title: "Супутникова (GeoInt / G-EGD)",
        desc: "Висока роздільна здатність від G-EGD (Maxar, SKY SAT, ICEYE). Оновлення від 1 години до декількох днів. Охоплює весь світ. Рекомендовано для планування операцій."
    },
    'PLANET_SAT': {
        title: "Супутникова від Planet.com",
        desc: "Покриває територію України та прикордоння. Найвища частота оновлення (щомісячно). Використовує більше 200 супутників."
    },
    'OPEN_TOPO': {
        title: "Топографічна (OpenTopoMap)",
        desc: "Складена ESRI та спільнотою ArcGIS. Містить населені пункти, водні об'єкти, дороги та адміністративні кордони всього світу."
    },
    'TOPO_DARK': {
        title: "Топографічна темна",
        desc: "Стилізована в темних тонах від Carto/ESRI. Мінімальна кількість кольорів та елементів для кращого сприйняття тактичної обстановки."
    },
    'VISICOM': {
        title: "Топографічна (Візіком/OSM)",
        desc: "Детальна карта 2023 року. Покриває Україну, Молдову, рб та рф. Містить усі дороги, аж до ґрунтових та польових."
    },
    'STAFF_SERVICE': {
        title: "Штабна (Топослужба)",
        desc: "Масштаб від 1:25 000 до 1:10 000 000. Надається Топографічною службою ЗСУ. Покриває Україну та прикордонні рф."
    },
    'STAFF_OLD': {
        title: "Штабна (застаріла)",
        desc: "Масштаб до 1:50 000. Найбільш детальна на території України станом на 2017-2022 роки. Доступна для друку невеликих розмірів."
    },
    'OSM': {
        title: "OpenStreetMap",
        desc: "Створена спільнотою картографів світу. Постійно оновлюється. Охоплює весь світ, містить велику кількість даних."
    },
    'STREET': {
        title: "Карта вулиць (World Street Map)",
        desc: "Спеціалізована версія від ESRI. Візуалізована для використання при русі автотранспортом, має індикатори напрямків."
    },
    'MARITIME': {
        title: "Морська (Navionics / Держгідрографія)",
        desc: "Навігаційна карта Чорноморсько-Азовського регіону. Містить дані про глибини, зони, коридори та навігаційні об'єкти."
    }
};

function showMapHelp(type) {
    const info = mapHelpData[type] || { title: "UNKNOWN_SOURCE", desc: "No description available for this layer." };
    const html = `
        <div style="padding: 10px;">
            <div style="color: var(--accent-blue); font-size: 0.9rem; font-weight: 800; margin-bottom: 12px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                ${info.title.toUpperCase()}
            </div>
            <div style="font-size: 0.85rem; line-height: 1.6; color: var(--text-primary); font-family: 'Inter', sans-serif;">
                ${info.desc}
            </div>
            <div style="margin-top: 20px; padding: 10px; background: rgba(59, 130, 246, 0.05); border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.1); font-size: 0.7rem; color: var(--accent-blue);">
                <strong style="margin-right: 5px;">СТАТУС:</strong> ДОСТУПНА ДЛЯ ДРУКУ І ОФЛАЙН ЗАВАНТАЖЕННЯ (PRO)
            </div>
        </div>
    `;
    openModal("MAP_INTEL // ДОВІДКА_ПО_КАРТІ", html);
}
