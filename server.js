require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

/* ROUTES */
const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

/* REGISTER ROUTES */
app.use("/api", authRoutes);
app.use("/api", playerRoutes);
app.use("/api", assessmentRoutes);
app.use("/api", dashboardRoutes);

/* SERVER */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});