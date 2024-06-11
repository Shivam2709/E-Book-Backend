import express from 'express';

import globalErrorHandler from './middlewares/globalErrorHandler';

const app = express();

//#region Routes
//Http methods: GET, POST, PUT, PATCH, DELETE
app.get('/', (req, res, next) => {
    res.json({message: "Welcome to elib apis"})

})

//#region Global error handler
    app.use(globalErrorHandler);

export default app;