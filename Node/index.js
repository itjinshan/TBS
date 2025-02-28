const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 6666;
const db_uri = process.env.MONGODB_URL;

mongoose
    .connect(db_uri)
    .then(() => {
        console.log('Database connected');
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    })
    .catch((err) => {
        console.log(err);
    });