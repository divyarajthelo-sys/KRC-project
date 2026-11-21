const mysql = require("mysql2");

/*
    Non-secret values still fall back to the
    original local defaults for convenience, but
    the password has NO fallback - it always comes
    from the environment (backend/.env locally,
    gitignored; real env vars when deployed), so it
    never sits in source code or git history.
*/
let poolConfig;

if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
    poolConfig = process.env.DATABASE_URL || process.env.MYSQL_URL;
} else {
    poolConfig = {
        host: process.env.DB_HOST || "127.0.0.1",
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_NAME || "krc_documents",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 10000,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
    };
}

const db = mysql.createPool(poolConfig);

db.query("SELECT 1", (err) => {
    if (err) {
        console.error("MySQL connection failed:", err.message);
        return;
    }

    console.log("MySQL connected successfully");
});

module.exports = db;