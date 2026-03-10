require("dotenv").config();

const express = require("express");
const cors = require("cors");

const setupDatabase = require("./setupDatabase");
const createAdmin = require("./createAdmin");

const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", authRoutes);
app.use("/api", playerRoutes);
app.use("/api", assessmentRoutes);
app.use("/api", dashboardRoutes);

const PORT = process.env.PORT || 10000;

async function startServer() {
  try {
    console.log("Setting up database...");
    await setupDatabase();

    console.log("Creating admin user...");
    await createAdmin();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Startup error:", error);
  }
}

startServer();