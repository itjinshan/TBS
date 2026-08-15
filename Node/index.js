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
const tripRouter = require('./APIs/trip');

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

// Sets req.lang from the standard Accept-Language header (see
// react-frontend/src/utils/setAuthToken.js's sibling axios default-header
// setup) so every route can localize its response text via Utils/i18n.js's
// t() — 'zh' only if the header explicitly starts with it, 'en' otherwise,
// same graceful-default spirit as this codebase's other optional-input
// handling.
app.use((req, res, next) => {
    const header = req.get('Accept-Language') || '';
    req.lang = header.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    next();
});

//route middleware
app.use('/', rootRouter);
app.use('/auth', authRouter);
app.use('/jwt', tokenRouter);
app.use('/dsservice', dsserviceRouter);
app.use('/trip', tripRouter);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});