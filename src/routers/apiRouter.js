const bodyParser = require('body-parser');

const APIHandler = require('../lib/api');

function buildRouter(config) {
    const app = require('express').Router({ mergeParams: true });

    let api;

    if (config.email && config.password && config.deviceId) {
        api = new APIHandler(config);
        api.init()
        .then(() => {
            app.route('/raindelay', bodyParser.json())
                .put((req, res) => {
                    const { delay } = req.body;
                    if (delay === undefined) {
                        res.sendStatus(400);
                    } else {
                        api.setRainDelay(delay);
                        res.sendStatus(200);
                    }
                })
                .delete(res => {
                    api.clearRainDelay();
                    res.sendStatus(200);
                });

            app.delete('/watering', (req, res) => {
                api.modeOff();
                res.sendStatus(200);
            });

            app.route('/watering/zone/:zoneId(\\d+)')
                .put((req, res) => {
                    const { minutes } = req.body;
                    if (minutes === undefined) {
                        res.sendStatus(400);
                    } else {
                        api.startZone(parseInt(req.params.zoneId), minutes);
                        res.sendStatus(200);
                    }
                })
                .delete((req, res) => {
                    api.stopZone();
                    res.sendStatus(200);
                });
        })
        .catch(err => {
            app.use((req, res, next) => {
                console.error("Can't complete request. API failed to initialize.", err);
                next();
            });
        });
    } else {
        app.use((req, res, next) => {
            console.error("Can't complete request. Missing required config fields.");
            next();
        });
    }

    return app;
}

module.exports = buildRouter;
