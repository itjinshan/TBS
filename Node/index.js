const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 6666;
const db_uri = process.env.MONGODB_URL;

// routes
//
const rootRouter = require('./APIs');
const authRouter = require('./APIs/auth');
const tokenRouter = require('./APIs/token');

mongoose
    .connect(db_uri)
    .then(() => {
        console.log('Database connected');
    })
    .catch((err) => {
        console.log(err);
    });

// middleware
//
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

//route middleware
app.use('/', rootRouter);
app.use('/auth', authRouter);
app.use('/jwt', tokenRouter);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});