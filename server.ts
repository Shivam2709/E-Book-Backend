import app from "./src/app";
import { config } from "./src/config/config";
import connectDB from "./src/config/db";


const startServer = async() => {
    // Database Connection 
    await connectDB();
    const port = config.port || 5000;

    app.listen(port, () => {
        console.log(`Listening on port: ${port}`);
        
    })
}

startServer();