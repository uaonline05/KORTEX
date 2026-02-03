// --- Configuration ---
const API_URL = "http://127.0.0.1:8000";
let map;
let markersLayer = L.layerGroup();
let trenchesLayer = L.layerGroup();
let currentBaseLayer;
let currentToken = localStorage.getItem("token");
let isAdmin = localStorage.getItem("isAdmin") === "true";

const mapStyles = {
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 }),
    sat: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 })
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

console.log("%c KORTEX SYSTEM READY [V3.1] ", "background: #22c55e; color: white; font-weight: bold; border: 2px solid white; padding: 5px;");

async function handleLogin() {
    const user = document.getElementById("username").value.trim().toLowerCase();
    const pass = document.getElementById("password").value.trim();

    if (!user || !pass) return alert("Please fill all fields");

    // NEW (V3.1): Super-Admin Local Authorization
    if (user === "admin" && pass === "admin123") {
        console.log("%c KORTEX: Super Admin Authorization Success. ", "background: #10b981; color: white;");
        currentToken = "super_admin_demo";
        isAdmin = true;
        localStorage.setItem("token", "super_admin_demo");
        localStorage.setItem("isAdmin", "true");
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
    document.getElementById("advanced-reg-overlay").style.display = "block";
}

function hideAdvancedReg() {
    document.getElementById("advanced-reg-overlay").style.display = "none";
    document.getElementById("auth-screen").style.display = "flex";
}

function handleAdvancedRegister() {
    const email = document.getElementById("reg-email").value;
    const user = document.getElementById("reg-username").value;

    if (!email || !user) return alert("Будь ласка, заповніть обов'язкові поля.");

    // Check if on GitHub Pages
    const isGitHub = window.location.hostname.includes('github.io');

    if (isGitHub) {
        hideAdvancedReg();
        showPending();
    } else {
        handleRegister();
    }
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

// --- Portal/Monitor Transitions ---
function openMonitor() {
    document.getElementById("portal-screen").style.display = "none";
    document.getElementById("map-overlay").style.display = "flex";

    if (!map) {
        initMap();
    }

    if (isAdmin) {
        document.getElementById("admin-tools").style.display = "block";
        loadPendingUsers();
    }

    loadMarkers();
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

    currentBaseLayer = mapStyles.dark;
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

// --- Side Panel Logic ---
let activePanel = null;

function togglePanel(type) {
    const panel = document.getElementById("side-panel");
    const content = document.getElementById("panel-content");

    if (activePanel === type) {
        panel.classList.remove("active");
        activePanel = null;
        return;
    }

    panel.classList.add("active");
    activePanel = type;
    renderPanelContent(type);
}

function renderPanelContent(type) {
    const content = document.getElementById("panel-content");
    let html = "";

    if (type === 'layers') {
        html = `
            <div class="panel-header"><h2>Шари</h2><button class="icon-btn" onclick="togglePanel('layers')">×</button></div>
            <div class="panel-search-wrapper"><input type="text" class="panel-search" placeholder="Пошук за назвою шару..."></div>
            <div class="panel-body">
                <div class="category-title">Глобальні</div>
                <div class="list-item">
                    <div class="list-item-icon">🚩</div>
                    <div class="list-item-info"><div class="list-item-name">Зони відповідальності</div><div class="list-item-desc">6 од.</div></div>
                </div>
                <div class="list-item">
                    <div class="list-item-icon">🚧</div>
                    <div class="list-item-info"><div class="list-item-name">Інженерні загородження рф</div><div class="list-item-desc">3983 од.</div></div>
                </div>
                <div class="list-item" onclick="toggleTrenches()">
                    <div class="list-item-icon">⛏️</div>
                    <div class="list-item-info"><div class="list-item-name">Система траншей рф</div><div class="list-item-desc">23451 од.</div></div>
                </div>
            </div>
        `;
    } else if (type === 'history') {
        html = `
            <div class="panel-header"><h2>Історичні стани</h2><button class="icon-btn" onclick="togglePanel('history')">×</button></div>
            <div class="panel-search-wrapper"><input type="text" class="panel-search" placeholder="Пошук..."></div>
            <div class="panel-body">
                <div class="list-item">
                    <div class="list-item-info"><div class="list-item-name">(ЛБЗ) Донецького напрямку</div><div class="list-item-desc">03/12/2025</div></div>
                </div>
                <div class="list-item">
                    <div class="list-item-info"><div class="list-item-name">ЛБЗ Запорізького напрямку</div><div class="list-item-desc">01/06/2023 - 15/10/2023</div></div>
                </div>
            </div>
        `;
    } else if (type === 'maps') {
        html = `
            <div class="panel-header"><h2>Карти</h2><button class="icon-btn" onclick="togglePanel('maps')">×</button></div>
            <div class="panel-body">
                <div class="list-item" onclick="changeMapStyle('sat')">
                    <img src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/10/350/600" width="40" height="40" style="border-radius:4px">
                    <div class="list-item-info"><div class="list-item-name">Супутникова (ESRI)</div></div>
                </div>
                <div class="list-item" onclick="changeMapStyle('topo')">
                    <img src="https://b.tile.opentopomap.org/10/600/350.png" width="40" height="40" style="border-radius:4px">
                    <div class="list-item-info"><div class="list-item-name">Топографічна</div></div>
                </div>
                <div class="list-item" onclick="changeMapStyle('dark')">
                    <div style="width:40px; height:40px; background:#111; border-radius:4px; border:1px solid #334155"></div>
                    <div class="list-item-info"><div class="list-item-name">Топографічна темна (CartoDB)</div></div>
                </div>
            </div>
        `;
    } else if (type === 'objects') {
        html = `
            <div class="panel-header"><h2>Список об'єктів</h2><button class="icon-btn" onclick="togglePanel('objects')">×</button></div>
            <div class="panel-body" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:#4b5563; padding-top: 4rem;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:1rem; opacity:0.5"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                <div style="font-size: 0.8rem;">Об'єктів не знайдено</div>
            </div>
        `;
    } else if (type === 'zones') {
        html = `
            <div class="panel-header"><h2>Зони спостереження</h2><button class="icon-btn" onclick="togglePanel('zones')">×</button></div>
            <div class="panel-body" style="display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding-top: 4rem;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:1rem; color:#3b82f6; opacity:0.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <div style="font-size: 0.8rem; color: #94a3b8; max-width: 300px; margin-bottom: 2rem; line-height: 1.5;">
                    Для отримання сповіщень про об'єкти у зоні ваших інтересів натисніть кнопку нижче.
                </div>
                <button class="auth-btn" style="width: auto; padding: 10px 30px; background: #3b82f6;">Створити зону</button>
            </div>
        `;
    } else if (type === 'filters') {
        const filterCategories = [
            "Шари", "Зона", "Присутність / боєздатність", "Прикріплення",
            "Пошукова фраза", "Ідентифікація", "Тип джерела",
            "Надійність / достовірність", "Тип об'єкта", "Останній редактор"
        ];
        html = `
            <div class="panel-header"><h2>Фільтри</h2><button class="icon-btn" onclick="togglePanel('filters')">×</button></div>
            <div style="display: flex; background: rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="flex: 1; padding: 10px; text-align: center; font-size: 0.75rem; border-bottom: 2px solid #3b82f6; color: white;">Усі фільтри</div>
                <div style="flex: 1; padding: 10px; text-align: center; font-size: 0.75rem; color: #64748b;">Набори</div>
            </div>
            <div class="panel-body" style="padding: 0;">
                ${filterCategories.map(cat => `
                    <div style="padding: 12px 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                        <span style="font-size: 0.8rem; color: #94a3b8;">${cat}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                `).join('')}
            </div>
            <div style="padding: 1rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 10px;">
                <button class="auth-btn" style="flex: 1; background: #272e3a; font-size: 0.75rem;">Очистити</button>
                <button class="auth-btn" style="flex: 1; background: #3b82f6; font-size: 0.75rem;">Застосувати</button>
            </div>
        `;
    }

    content.innerHTML = html;
}

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
    showNotification("Opening asset library...");
}

function showAlerts() {
    showNotification("System: No active threats detected in your sector.");
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
    try {
        const response = await fetch(`${API_URL}/admin/pending`, {
            headers: { "Authorization": `Bearer ${currentToken}` }
        });
        const users = await response.json();
        renderPendingUsersList(users);
    } catch (err) {
        // Fallback for GitHub: Show mock pending users for Admin showcase
        const mockUsers = [
            { id: 101, username: "Sgt. Petrov" },
            { id: 102, username: "Lt. Ivanova" },
            { id: 103, username: "Unit-772" }
        ];
        renderPendingUsersList(mockUsers);
    }
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
    try {
        const response = await fetch(`${API_URL}/admin/approve/${userId}`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${currentToken}` }
        });

        if (response.ok) {
            showNotification(`ACCESS GRANTED: ${username}`);
            loadPendingUsers();
        } else {
            // Local bypass for GitHub
            showNotification(`ACCESS GRANTED: ${username} (OFFLINE MODE)`);
            document.querySelector(`button[onclick="approveUser(${userId}, '${username}')"]`).parentElement.remove();
        }
    } catch (err) {
        // Local bypass for GitHub
        showNotification(`ACCESS GRANTED: ${username} (OFFLINE MODE)`);
        const item = document.querySelector(`button[onclick*="approveUser(${userId}"]`);
        if (item) item.parentElement.remove();
    }
}

// --- Status/Clock ---
setInterval(() => {
    const now = new Date();
    // In many military apps they use local time but label it or use UTC. Using local for demo.
    const timeStr = now.toLocaleTimeString('uk-UA', { hour12: false });
    // Just a fun way to simulate a ticking clock in the status bar if we had one
}, 1000);
