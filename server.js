const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const frontendPath = path.join(__dirname, "..", "frontend");
app.use(express.static(frontendPath));
app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

const dataPath = path.join(__dirname, "data.json");

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper function to get ATM status
function getATMStatus(cash) {
  if (cash === 0) return "No Cash";
  else if (cash < 50000) return "Low Cash";
  else return "Cash Available";
}

// ============ API ROUTES ============

// Login endpoint
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  
  if (username === "user" && password === "pass") {
    res.json({
      success: true,
      token: "token_" + Date.now(),
      message: "Login successful"
    });
  } else {
    res.json({
      success: false,
      message: "Invalid credentials"
    });
  }
});

// Search nearby ATMs
app.post("/api/search-nearby", (req, res) => {
  const { lat, lng, radiusKm } = req.body;
  
  if (!lat || !lng || !radiusKm) {
    return res.json({
      success: false,
      message: "Missing required parameters"
    });
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(dataPath));
    
    // Filter ATMs within radius and add distance
    const nearbyATMs = data
      .map(atm => ({
        ...atm,
        distance: parseFloat(calculateDistance(lat, lng, atm.lat, atm.lng).toFixed(2))
      }))
      .filter(atm => atm.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
    
    // Add status to each ATM
    const result = nearbyATMs.map(atm => ({
      ...atm,
      status: getATMStatus(atm.cash)
    }));
    
    res.json({
      success: true,
      atms: result,
      count: result.length
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Error fetching ATMs: " + error.message
    });
  }
});

// Get single ATM status
app.get("/api/atm/:id", (req, res) => {
  const atmId = parseInt(req.params.id);
  
  try {
    const data = JSON.parse(fs.readFileSync(dataPath));
    const atm = data.find(a => a.id === atmId);
    
    if (!atm) {
      return res.json({
        success: false,
        message: "ATM not found"
      });
    }
    
    // Simulate live cash changes
    const changePercent = (Math.random() - 0.5) * 0.3;
    const changedCash = Math.max(0, Math.round(atm.cash + (atm.cash * changePercent)));
    
    res.json({
      success: true,
      atm: {
        ...atm,
        cash: changedCash,
        status: getATMStatus(changedCash),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Error fetching ATM: " + error.message
    });
  }
});

// Get ATM data (legacy endpoint)
app.get("/atms", (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataPath));
  
  // Shuffle array to get random ATMs
  const shuffled = data.sort(() => Math.random() - 0.5);
  // Get first 5 random ATMs
  const randomATMs = shuffled.slice(0, 5);
  
  const result = randomATMs.map(atm => {
    // Randomly change cash value slightly to simulate transactions
    const changePercent = (Math.random() - 0.5) * 0.3; // ±15% change
    const changedCash = Math.max(0, Math.round(atm.cash + (atm.cash * changePercent)));
    
    return { ...atm, cash: changedCash, status: getATMStatus(changedCash) };
  });

  res.json(result);
});

// Update ATM cash (legacy endpoint)
app.post("/update", (req, res) => {
  let data = JSON.parse(fs.readFileSync(dataPath));
  
  const { id, cash } = req.body;

  data = data.map(atm =>
    atm.id === id ? { ...atm, cash } : atm
  );

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  res.json({ success: true, message: "Updated Successfully" });
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});