const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();


// ===== CORS CONFIGURATION =====

app.use(cors({
    origin: "*",
    methods: ["GET","POST","PUT","DELETE"],
    allowedHeaders: ["Content-Type","Authorization"]
}));


app.use(express.json());


// ===== ROUTES =====

const authRoutes = require("./routes/authRoutes");
const playerRoutes = require("./routes/playerRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");

app.use("/api", authRoutes);
app.use("/api", playerRoutes);
app.use("/api", assessmentRoutes);


// ===== TEST ROUTE =====

app.get("/", (req,res)=>{
    res.send("Sportz-Well Backend Running");
});


// ===== START SERVER =====

const PORT = process.env.PORT || 10000;

app.listen(PORT, ()=>{
    console.log("Sportz-Well API running on port", PORT);
});