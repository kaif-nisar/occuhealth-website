import mongoose from "mongoose";

export const Connect_DB = async () => {
    try {
        const connection = await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: Math.max(5, Number.parseInt(process.env.MONGO_MAX_POOL_SIZE || "15", 10)),
            minPoolSize: Math.max(1, Number.parseInt(process.env.MONGO_MIN_POOL_SIZE || "2", 10)),
            socketTimeoutMS: Number.parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || "30000", 10),
            serverSelectionTimeoutMS: Number.parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || "10000", 10),
            heartbeatFrequencyMS: Number.parseInt(process.env.MONGO_HEARTBEAT_FREQUENCY_MS || "10000", 10),
            maxIdleTimeMS: Number.parseInt(process.env.MONGO_MAX_IDLE_TIME_MS || "60000", 10),
            bufferCommands: false,
        });

        console.log(`MongoDB Connected: ${connection.connection.host}`);
        return connection;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default Connect_DB;
