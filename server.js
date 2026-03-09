// ===============================
// Sportz-Well Backend Server
// Production Version
// ===============================

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();


// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json());


// ===============================
// ROUTES
// ===============================

const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");

app.use("/api", authRoutes);
app.use("/api", playerRoutes);
app.use("/api", assessmentRoutes);


// ===============================
// HEALTH CHECK
// ===============================

app.get("/", (req, res) => {

    res.send("Sportz-Well Backend Running");

});


// ===============================
// SERVER START
// ===============================

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

    console.log(`Sportz-Well API running on port ${PORT}`);

});