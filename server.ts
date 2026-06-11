import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { MallStore, MallKiosk, CCTVCamera, FootTrafficCampaign, FacilityAlert } from "./src/types.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize GoogleGenAI SDK safely
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    console.log("Google GenAI client initialized successfully on server-side.");
  } catch (error) {
    console.error("Failed to initialize Google GenAI client:", error);
  }
} else {
  console.warn("GEMINI_API_KEY is not defined or is set to placeholder in environment variables. Gemini features will run in local simulation/guided model fallback modes.");
}

// Memory Database (Simulated Mall Digital Twin State)
let stores: MallStore[] = [
  { id: "store-1", name: "Aura Boutique", category: "Fashion", x: 50, y: 50, width: 140, height: 110, baseFootfall: 420, conversionRate: 0.12, currentOccupancy: 45, layoutEfficiencyScore: 78, signageMessage: "Season Sale: Up to 40% Off Select Apparels!", signagePromoCode: "AURA40" },
  { id: "store-2", name: "ElectroVerse", category: "Tech", x: 210, y: 50, width: 160, height: 110, baseFootfall: 680, conversionRate: 0.08, currentOccupancy: 62, layoutEfficiencyScore: 84, signageMessage: "Experience the Future: Play the New VR headset today!", signagePromoCode: "PLAYVR" },
  { id: "store-3", name: "Luxe Thread & Co", category: "Fashion", x: 390, y: 50, width: 130, height: 110, baseFootfall: 310, conversionRate: 0.15, currentOccupancy: 18, layoutEfficiencyScore: 91, signageMessage: "Private Styling Consultations available inside.", signagePromoCode: "LUXESTYLE" },
  { id: "store-4", name: "Saffron Bites", category: "Food", x: 50, y: 220, width: 150, height: 120, baseFootfall: 950, conversionRate: 0.28, currentOccupancy: 88, layoutEfficiencyScore: 62, signageMessage: "Happy Hour! Get a free chai with any premium roll.", signagePromoCode: "SAFFRONCHAI" },
  { id: "store-5", name: "Blush Cosmetics", category: "Beauty", x: 590, y: 50, width: 140, height: 140, baseFootfall: 450, conversionRate: 0.14, currentOccupancy: 34, layoutEfficiencyScore: 80, signageMessage: "Complimentary skin diagnosis & glow analysis today!", signagePromoCode: "GLOWOUT" },
  { id: "store-6", name: "The Book Haven", category: "Fashion", x: 590, y: 220, width: 140, height: 120, baseFootfall: 280, conversionRate: 0.22, currentOccupancy: 12, layoutEfficiencyScore: 88, signageMessage: "Dive into adventures. Weekly top 10 best sellers 15% off.", signagePromoCode: "READ15" },
  { id: "anchor-west", name: "Galactic Outfitters", category: "Anchor", x: 50, y: 390, width: 280, height: 160, baseFootfall: 1500, conversionRate: 0.10, currentOccupancy: 110, layoutEfficiencyScore: 72, signageMessage: "Grand Opening Weekend! Buy 2, Get 1 Free on all departments.", signagePromoCode: "GALACTIC3" },
  { id: "anchor-east", name: "Vanguard Grocery", category: "Anchor", x: 450, y: 390, width: 280, height: 160, baseFootfall: 1900, conversionRate: 0.35, currentOccupancy: 142, layoutEfficiencyScore: 69, signageMessage: "Freshness Redefined: Local organic avocados back in stock!", signagePromoCode: "FRESHAVO" }
];

let kiosks: MallKiosk[] = [
  { id: "kiosk-a", name: "Pretzel Twist", type: "Food Cart", x: 230, y: 230, densityFactor: 1.4 },
  { id: "kiosk-b", name: "Gelato Scoop", type: "Desserts", x: 390, y: 230, densityFactor: 1.2 },
  { id: "kiosk-c", name: "Charge & Go", type: "Charging Station", x: 530, y: 250, densityFactor: 1.0 }
];

let cameras: CCTVCamera[] = [
  { id: "cam-north", name: "CCTV - Main Entrance Hallway", x: 190, y: 190, angle: 45, status: "active", currentCount: 12, dwellTimeAvg: 34, congestionLevel: "Low" },
  { id: "cam-food", name: "CCTV - Food Hub Corridor", x: 260, y: 360, angle: 135, status: "active", currentCount: 48, dwellTimeAvg: 110, congestionLevel: "High" },
  { id: "cam-center", name: "CCTV - Central Promenade Plaza", x: 380, y: 350, angle: 90, status: "active", currentCount: 35, dwellTimeAvg: 85, congestionLevel: "Medium" },
  { id: "cam-east", name: "CCTV - Fashion Wing Plaza", x: 550, y: 190, angle: 220, status: "active", currentCount: 8, dwellTimeAvg: 25, congestionLevel: "Low" },
  { id: "cam-west", name: "CCTV - South Gate Aisle", x: 380, y: 480, angle: 270, status: "active", currentCount: 52, dwellTimeAvg: 145, congestionLevel: "High" }
];

let campaigns: FootTrafficCampaign[] = [
  { id: "camp-0", storeId: "store-4", storeName: "Saffron Bites", promoTitle: "Crowd Rush Fuel", promoText: "Flash Deal: 15% discount on rolls to capture South Aisle commuters!", targetAisle: "South Gate Aisle", status: "Active", shoppersReached: 142, timestamp: new Date(Date.now() - 3600000).toLocaleString() },
  { id: "camp-1", storeId: "store-1", storeName: "Aura Boutique", promoTitle: "Promenade Direct", promoText: "Get an exclusive 10% coupon when moving from Central Plaza to Aura Clothing!", targetAisle: "Central Promenade Plaza", status: "Active", shoppersReached: 88, timestamp: new Date(Date.now() - 7200000).toLocaleString() }
];

let alerts: FacilityAlert[] = [
  { id: "alert-1", location: "Food Court Entrance (Near Saffron Bites)", severity: "warning", message: "Queue bottleneck detected blockading emergency exits. Suggest automated redirection campaign and signal dispatch.", timestamp: new Date(Date.now() - 1500000).toLocaleTimeString(), status: "Active" },
  { id: "alert-2", location: "South Gate Plaza", severity: "critical", message: "Density threshold exceeded (2.4 shoppers/sqm). High risk of congestion bottleneck at anchor doors.", timestamp: new Date(Date.now() - 600000).toLocaleTimeString(), status: "Active" }
];

// Helper to update camera stats dynamically to simulate ongoing traffic shifts
const simulateActivityTick = () => {
  cameras = cameras.map(cam => {
    // fluctuate current count
    const variance = Math.floor(Math.random() * 9) - 4; // -4 to +4
    let newCount = cam.currentCount + variance;
    if (newCount < 2) newCount = 2;
    if (newCount > 90) newCount = 90;

    // determine congestion Level
    let level: "Low" | "Medium" | "High" = "Low";
    if (newCount > 40) level = "High";
    else if (newCount > 15) level = "Medium";

    // dwell times fluctuate
    const newDwell = Math.max(10, Math.floor(cam.dwellTimeAvg + (Math.random() * 11 - 5)));

    return {
      ...cam,
      currentCount: newCount,
      dwellTimeAvg: newDwell,
      congestionLevel: level
    };
  });

  // Fluctuate store occupant levels based on surrounding congestion
  stores = stores.map(store => {
    const shift = Math.floor(Math.random() * 5) - 2; // -2 to +2
    let newOcc = store.currentOccupancy + shift;
    if (newOcc < 3) newOcc = 3;
    if (newOcc > store.baseFootfall / 4) newOcc = Math.floor(store.baseFootfall / 4);
    return {
      ...store,
      currentOccupancy: newOcc
    };
  });
};

// API: Check-in / Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Mall Digital Twin Server" });
});

// GET: Core State variables
app.get("/api/mall-data", (req, res) => {
  res.json({
    stores,
    kiosks,
    cameras,
    campaigns,
    alerts
  });
});

// POST: Trigger custom tick override
app.post("/api/simulate-tick", (req, res) => {
  simulateActivityTick();
  res.json({
    message: "Simulation tick applied.",
    cameras,
    stores
  });
});

// POST: Update specific digital signage text (Actions beyond chat)
app.post("/api/signage", (req, res) => {
  const { storeId, signageMessage, signagePromoCode } = req.body;
  if (!storeId) {
    return res.status(400).json({ error: "Missing storeId reference." });
  }

  const storeIdx = stores.findIndex(s => s.id === storeId);
  if (storeIdx === -1) {
    return res.status(404).json({ error: "Store not found." });
  }

  stores[storeIdx].signageMessage = signageMessage || stores[storeIdx].signageMessage;
  stores[storeIdx].signagePromoCode = signagePromoCode || stores[storeIdx].signagePromoCode;

  res.json({
    message: "Digital Signage updated successfully across the virtual network.",
    updatedStore: stores[storeIdx]
  });
});

// POST: Register / Dispatch hyper-local push campaigns
app.post("/api/campaign", (req, res) => {
  const { storeId, promoTitle, promoText, targetAisle } = req.body;
  if (!storeId || !promoTitle || !promoText || !targetAisle) {
    return res.status(400).json({ error: "Missing campaign configuration inputs." });
  }

  const matchedStore = stores.find(s => s.id === storeId);
  if (!matchedStore) {
    return res.status(404).json({ error: "Associated store not found in tenant index." });
  }

  const newCampaign: FootTrafficCampaign = {
    id: `camp-${Date.now()}`,
    storeId,
    storeName: matchedStore.name,
    promoTitle,
    promoText,
    targetAisle,
    status: "Active",
    shoppersReached: Math.floor(Math.random() * 50) + 12,
    timestamp: new Date().toLocaleString()
  };

  campaigns.unshift(newCampaign);
  res.json({
    message: "Hyper-local marketing campaign active on tenant broadcast system.",
    campaign: newCampaign,
    allCampaigns: campaigns
  });
});

// POST: Resolve or create security/crowding Alerts
app.post("/api/alerts/resolve", (req, res) => {
  const { alertId } = req.body;
  if (!alertId) {
    return res.status(400).json({ error: "Missing alertId parameter." });
  }

  const idx = alerts.findIndex(a => a.id === alertId);
  if (idx === -1) {
    return res.status(404).json({ error: "Facility alert not found." });
  }

  alerts[idx].status = "Resolved";
  res.json({
    message: "Active facility hazard resolved. Automated registers synchronized.",
    alert: alerts[idx],
    allAlerts: alerts
  });
});

// POST: Trigger Custom Facility Alert
app.post("/api/alerts/create", (req, res) => {
  const { location, severity, message } = req.body;
  if (!location || !severity || !message) {
    return res.status(400).json({ error: "Missing alert registration fields." });
  }

  const newAlert: FacilityAlert = {
    id: `alert-${Date.now()}`,
    location,
    severity: severity as "info" | "warning" | "critical",
    message,
    timestamp: new Date().toLocaleTimeString(),
    status: "Active"
  };

  alerts.unshift(newAlert);
  res.json({
    message: "Hazard logged successfully. Redirection protocols initiated.",
    alert: newAlert,
    allAlerts: alerts
  });
});

// POST: AI Agent Layout & Heatmap Analyzer Endpoint using Gemini
app.post("/api/analyze-cv", async (req, res) => {
  const { customPrompt, cameraFocusId } = req.body;

  // Formulate absolute context report for Gemini grounding
  const cctvSummary = cameras.map(c => `- ${c.name} (ID: ${c.id}) at coordinates (X:${c.x}, Y:${c.y}) reports count of ${c.currentCount} shoppers, average dwell time of ${c.dwellTimeAvg}s, Congestion Level: ${c.congestionLevel}`).join("\n");
  const tenantSummary = stores.map(s => `- Store: ${s.name} (${s.category}) has occupancy ${s.currentOccupancy}/${s.baseFootfall / 4}, conversion rate ${(s.conversionRate * 100).toFixed(0)}%, layout score: ${s.layoutEfficiencyScore}/100`).join("\n");
  const alertsActive = alerts.filter(a => a.status === "Active").map(a => `* ALERT AT: ${a.location} - SEVERITY: ${a.severity.toUpperCase()} - MSG: ${a.message}`).join("\n") || "No active alerts currently.";

  const baselineSystemInstruction = `You are an elite, computer-vision modeling retail layout architect and mall optimizer AI agent.
Analyze the provided real-time shopping mall layout metrics, cctv density sensors, and spatial occupancy grids to identify:
1. Spatial Bottlenecks (where flow is obstructed, such as corridors near high dwell hotspots).
2. Cold Zone Leaks (where tenants are receiving far lower shopper traffic than their capacity).
3. Immediate structural layout adjustments (e.g. relocating cart displays, shifting entries, expanding counter areas).
4. Direct feedback on stores and layout efficiency improvements.

Be extremely concrete: use specific names of stores and CCTV feeds in your feedback. Avoid vague suggestions like "improve lighting". Suggest adjustments like "Saffron Bites is highly crowded with 88 customers blocking the hallway. Shift the visual order displays to the west corridor to release traffic and dispatch a digital flash sale redirecting Saffron's queue spillover to Luxe Thread nearby."

If a user provided a specific cameraFocusId, give hyper-specialized feedback on that specific area coordinates first.`;

  const finalPrompt = `
=== MALL FLOOR MONITORING SYSTEM Twin ===
ACTIVE CCTV SENSORS:
${cctvSummary}

TENANT OCCUPANCIES & CONVERSIONS:
${tenantSummary}

ACTIVE HAZARDS & CROWDING ALERTS:
${alertsActive}

CAMERA OF SPECIAL FOCUS: ${cameraFocusId || "ALL CAMERAS"}
USER / INSTRUCTIONAL COMPASS: ${customPrompt || "Analyze overall congestion and suggest a complete physical and digital layout action plan."}
  `;

  if (!ai) {
    // Generate a beautiful, smart pre-baked detailed simulated response to ensure offline demo environments STILL look spectacular!
    // This provides a resilient UX in case API keys are pending configuration.
    const mockReports = [
      `### 📊 Computer Vision spatial report (Simulated Engine)

**1. Analysis of Focus Zone: ${cameraFocusId || "All Walkways"}**
* **Active Crowd Detected**: Sensor node \`cam-food\` monitoring the *Food Hub Corridor* registers a critical traffic density count of **48 persons** and a massive average dwell time of **110 seconds**. This is the core bottleneck of the second floor promenade.
* **Saffron Bites Spillover**: Saffron Bites is working at near full-capacity (88 occupants). Digital analytics show that its queue layout stretches into the main pathway directly colliding with the \`kiosk-a\` (Pretzel Twist) structure, degrading the corridor's flow and layout efficiency (Layout Score: 62).

**2. Tactical Structural Adjustments**
* **Redesign Kiosk Coordinates**: Relocate \`kiosk-a\` (Pretzel Twist) approximately **12 feet east** into the Central Promenade Plaza (near \`cam-center\`). This widens the primary North-to-South walk channel from 8 feet to 18 feet, completely clearing the bottleneck.
* **Queue Decoupling**: Instruct Saffron Bites to structure a linear corral queue alongside their interior glass pane, rather than letting patrons stack perpendicular to the corridor.

**3. Direct Tenant Campaign recommendations**
* **Push Redirection Alerts**: Dispatch live digital coupons for **Luxe Thread & Co** (currently under-utilized with only 18 active shoppers) directly to screens adjacent to the Food Corridor.
* **Smart Signage Dispatch**: Update Aura Boutique's local signage to run code \`AURA40\` to siphon fashion-oriented strollers away from the central bottlenecks.`,

      `### 📊 Computer Vision Spatial Report (Simulated Engine)

**Critical Hotspot Detected near South Gate: Cam-West (Count: 52, Dwell: 145s)**
* **Observations**: High congestion detected entering/exiting *Galactic Outfitters* anchor space. The visual sensor observes pedestrian deceleration at the transition grid.
* **Root Cause**: Digital floor-directories are placed directly in front of the major exit doors, causing pedestrian grouping and deceleration grids.
* **Action Recommendation**:
  1. Relocate the digital touch directories 20 feet away to the Eastern corridor.
  2. Implement an automated spatial balancing campaign on Saffron Bites to draw waiting stumblers north.
  3. Change the Digital Billboard above the South Hallway to broadcast "15% off Vanguard Grocery Fresh Fruit" utilizing promo code \`FRESHAVO\` to balance crowd distribution.`
    ];

    const randomMock = mockReports[Math.floor(Math.random() * mockReports.length)];
    // Add slightly delayed return to mimic actual API processing
    await new Promise((res) => setTimeout(res, 900));
    return res.json({
      success: true,
      mode: "simulation",
      analysisText: randomMock,
      suggestedCampaign: {
        storeId: "store-3",
        promoTitle: "Breathe in Style",
        promoText: "Skip the food lines! Visit Luxe Thread for custom fit-outs and get a free catalog with code LUXESTYLE.",
        targetAisle: "Food Hub Corridor"
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: finalPrompt,
      config: {
        systemInstruction: baselineSystemInstruction,
        temperature: 0.8,
      },
    });

    const analysisText = response.text || "No response generated from model.";

    // Let's parser or derive an action campaign automatically based on the text
    // We can do another quick light extraction or generate structured layout feedback.
    res.json({
      success: true,
      mode: "api",
      analysisText,
      suggestedCampaign: {
        storeId: "store-3",
        promoTitle: "Breathe in Style",
        promoText: "Explore the newest Luxe collection. Get a custom mock fitting in a premium booth! Code: LUXESTYLE",
        targetAisle: "Food Hub Corridor"
      }
    });

  } catch (err: any) {
    console.error("Gemini API call failed, falling back to simulated analysis:", err);
    
    const mockReports = [
      `### 📊 Computer Vision spatial report (Simulated Engine)

**1. Analysis of Focus Zone: ${cameraFocusId || "All Walkways"}**
* **Active Crowd Detected**: Sensor node \`cam-food\` monitoring the *Food Hub Corridor* registers a critical traffic density count of **48 persons** and a massive average dwell time of **110 seconds**. This is the core bottleneck of the second floor promenade.
* **Saffron Bites Spillover**: Saffron Bites is working at near full-capacity (88 occupants). Digital analytics show that its queue layout stretches into the main pathway directly colliding with the \`kiosk-a\` (Pretzel Twist) structure, degrading the corridor's flow and layout efficiency (Layout Score: 62).

**2. Tactical Structural Adjustments**
* **Redesign Kiosk Coordinates**: Relocate \`kiosk-a\` (Pretzel Twist) approximately **12 feet east** into the Central Promenade Plaza (near \`cam-center\`). This widens the primary North-to-South walk channel from 8 feet to 18 feet, completely clearing the bottleneck.
* **Queue Decoupling**: Instruct Saffron Bites to structure a linear corral queue alongside their interior glass pane, rather than letting patrons stack perpendicular to the corridor.

**3. Direct Tenant Campaign recommendations**
* **Push Redirection Alerts**: Dispatch live digital coupons for **Luxe Thread & Co** (currently under-utilized with only 18 active shoppers) directly to screens adjacent to the Food Corridor.
* **Smart Signage Dispatch**: Update Aura Boutique's local signage to run code \`AURA40\` to siphon fashion-oriented strollers away from the central bottlenecks.`,

      `### 📊 Computer Vision Spatial Report (Simulated Engine)

**Critical Hotspot Detected near South Gate: Cam-West (Count: 52, Dwell: 145s)**
* **Observations**: High congestion detected entering/exiting *Galactic Outfitters* anchor space. The visual sensor observes pedestrian deceleration at the transition grid.
* **Root Cause**: Digital floor-directories are placed directly in front of the major exit doors, causing pedestrian grouping and deceleration grids.
* **Action Recommendation**:
  1. Relocate the digital touch directories 20 feet away to the Eastern corridor.
  2. Implement an automated spatial balancing campaign on Saffron Bites to draw waiting stumblers north.
  3. Change the Digital Billboard above the South Hallway to broadcast "15% off Vanguard Grocery Fresh Fruit" utilizing promo code \`FRESHAVO\` to balance crowd distribution.`
    ];

    const randomMock = mockReports[Math.floor(Math.random() * mockReports.length)];
    const fallbackText = `> *⚠️ Note: Running in local twin diagnostics mode.* \n\n${randomMock}`;

    res.json({
      success: true,
      mode: "simulation_fallback",
      analysisText: fallbackText,
      suggestedCampaign: {
        storeId: "store-3",
        promoTitle: "Breathe in Style",
        promoText: "Skip the food lines! Visit Luxe Thread for custom fit-outs and get a free catalog with code LUXESTYLE.",
        targetAisle: "Food Hub Corridor"
      }
    });
  }
});

// POST: Fully automated Campaign creation Agent endpoint
app.post("/api/agent-auto-campaign", async (req, res) => {
  if (!ai) {
    // Pre-baked smart Agent response
    const chosenStore = stores[Math.floor(Math.random() * stores.length)];
    const randomAisles = ["Food Hub Corridor", "Central Promenade Plaza", "South Gate Aisle"];
    const chosenAisle = randomAisles[Math.floor(Math.random() * randomAisles.length)];

    const genericCam: FootTrafficCampaign = {
      id: `camp-${Date.now()}`,
      storeId: chosenStore.id,
      storeName: chosenStore.name,
      promoTitle: "Agent Target Promo",
      promoText: `Special traffic relief deal automatically initialized! Code: ${chosenStore.signagePromoCode || "SAVE15"}`,
      targetAisle: chosenAisle,
      status: "Active",
      shoppersReached: 55,
      timestamp: new Date().toLocaleString()
    };
    campaigns.unshift(genericCam);

    return res.json({
      success: true,
      mode: "simulation",
      campaign: genericCam,
      reasoning: "Launched local simulated balancing promo due to detected crowd blockages near target corridor."
    });
  }

  try {
    // Use structured response schema to have Gemini determine the BEST balancing promotion
    const mostCongestedCam = [...cameras].sort((a,b) => b.currentCount - a.currentCount)[0];
    const underperformingStore = [...stores].sort((a,b) => a.currentOccupancy - b.currentOccupancy)[0];

    const promptText = `
Based on the current mall situation:
- High Danger Area: "${mostCongestedCam.name}" with density count "${mostCongestedCam.currentCount}" and status "${mostCongestedCam.congestionLevel}".
- Cool Tenant Zone to Help: "${underperformingStore.name}" (${underperformingStore.category}) with current occupancy of only ${underperformingStore.currentOccupancy}.

Generate a target FootTrafficCampaign with:
1. A smart Title, e.g., "North Corridor Relief Offer"
2. A compelling, highly specific description copy to entice shoppers away from the crowded corridor towards the cool store.
3. The exact target corridor coordinates to intercept.

Respond with the exact campaign fields.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            promoTitle: { type: Type.STRING },
            promoText: { type: Type.STRING },
          },
          required: ["promoTitle", "promoText"]
        }
      }
    });

    const bodyText = JSON.parse(response.text || "{}");

    const newCampaign: FootTrafficCampaign = {
      id: `camp-${Date.now()}`,
      storeId: underperformingStore.id,
      storeName: underperformingStore.name,
      promoTitle: bodyText.promoTitle || "Agent Traffic Balancing Offer",
      promoText: bodyText.promoText || `Relieve the crowd! Stop by ${underperformingStore.name} right now for an exclusive discount! Code: ${underperformingStore.signagePromoCode || "SAVE10"}`,
      targetAisle: mostCongestedCam.name.replace("CCTV - ", ""), // Map back cleanly
      status: "Active",
      shoppersReached: Math.floor(Math.random() * 80) + 15,
      timestamp: new Date().toLocaleString()
    };

    campaigns.unshift(newCampaign);

    res.json({
      success: true,
      mode: "api",
      campaign: newCampaign,
      reasoning: `AI Agent identified high density bottleneck at ${mostCongestedCam.name} (Count: ${mostCongestedCam.currentCount}) and automatically designed balancing campaign to redirect shoppers to cold-zone: ${underperformingStore.name}.`
    });

  } catch (error: any) {
    console.error("AI automated agent campaign creation failed, falling back to simulated fallback:", error);
    
    const chosenStore = stores[Math.floor(Math.random() * stores.length)];
    const randomAisles = ["Food Hub Corridor", "Central Promenade Plaza", "South Gate Aisle"];
    const chosenAisle = randomAisles[Math.floor(Math.random() * randomAisles.length)];

    const fallbackCampaign: FootTrafficCampaign = {
      id: `camp-${Date.now()}`,
      storeId: chosenStore.id,
      storeName: chosenStore.name,
      promoTitle: "Simulated Traffic Relief",
      promoText: `Special traffic relief deal automatically initialized to redirect crowds! Code: ${chosenStore.signagePromoCode || "SAVE15"}`,
      targetAisle: chosenAisle,
      status: "Active",
      shoppersReached: Math.floor(Math.random() * 40) + 30,
      timestamp: new Date().toLocaleString()
    };
    campaigns.unshift(fallbackCampaign);

    res.json({
      success: true,
      mode: "simulation_fallback",
      campaign: fallbackCampaign,
      reasoning: `Local simulated balancing promo initiated due to detected crowd blockages near target corridor.`
    });
  }
});

// Configure Vite or Static server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Setting up Vite Express Development Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Production Build. Mounting static assets from /dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MallFlow Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
