const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 6666;

// routes
//
const rootRouter = require('./APIs');
const authRouter = require('./APIs/auth');
const dsserviceRouter = require('./APIs/dsservice');
const tokenRouter = require('./APIs/token');

mongoose
    .connect(process.env.MONGODB_URL)
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
app.use('/dsservice', dsserviceRouter);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});