# Orbit BHyve Remote

_*This is not an officially supported image or project*_

This project is a simple implementation of the unofficial API to control the BHyve Orbit Wifi irrigation controller.

The purpose of this project is to provide an application that you can host to use with IFTTT to allow you to control your sprinklers.
This application only allows for controlling a specific device. Multi-device support maybe in the future.

# Required Config Information

You need your DeviceID that you want to control. I don't have a good way of this, other than manually.

## Getting your DeviceID

1. Go to https://my.orbitbhyve.com/ (but don't log in, yet)
2. Open your developer tools and go to the network tab
3. Log in to Orbit (or refresh the page if you are already logged in)
4. Look for an XHR request to http://api.orbithyve.com/devices
    1. We can't hit this URL directly without an API token header, so just look for it in the network tab
5. The results of this call is an array of all the devices on your account
6. Find the named device you want to control and get the `id` column for that part of the payload
7. Save this for later

# Create your config.json

Create a config.json file in a new directory with the following contents (if you are building locally, put it in ./volumes/config/):

```json
{
    "email": "your bhyve email account",
    "password": "your bhyve password",
    "deviceId": "the id from above",
    "token": "<a random token to use for security so only you can control your requests>"
}
```

# Docker compose

Take a look at docker-compose.yml.example for the environment that you are interested in using.
We need to configure the configuration volume to point at the directory with our config.json file in it.
```yml
    volumes:
      - /path/to/your/config/file:/bhyve/config
```

Now you can `docker-compose up -d` to get your container running.

# IFTTT

Once your container is running and is accessible from the internet, we can configure IFTTT to interact with it.
We can use a Voice Command to trigger a [WebHook](https://ifttt.com/maker_webhooks) Action that will hit our URLs with the correct information.
It's a little bit manual, but what can you do?

# API End Points

See src/routers/apiRouter.js for implementations

| Method | URL | Body | Description |
| ------ | --- | ------- | ----------- |
| PUT | /raindelay | { "delay": `int hours` } | Start a rain delay of `hours` hours |
| DELETE | /raindelay | | Remove a rain delay. Same as using 0 hours. |
| PUT | /watering/zone/`int zoneId` | { "minutes": `int` } | Start watering zone `zoneId` for `minutes` |
| DELETE | /watering/zone/`int zoneId` | | Stop watering |
| DELETE | /watering | | Stop watering |

# Sample IFTTT Applet setup

## Trigger:
Service: Google Assistant \
Trigger: Say a phrase with a number \
What do you want to say? water zone # \
What do you want the system to say in response? Aguamenti

## Action:
Service: Webhooks \
Action: Make a web request \
URL: http://my.service.url:1337/api/watering/zone/{{NumberField}} \
Method: PUT \
Content Type: application/json \
Body: {"minutes": 15, "token": "security token from config.json file"}