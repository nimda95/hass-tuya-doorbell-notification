## Introduction
If you own a Tuya doorbell, and wanted to link-it to homeassistant, you will find-out that you can't have a trigger if somebody is ringing the doorbell, which defies the whole purpose of having the integration.
Hence why this little script :D.
## Setup
You will need a homeassistant automation with a webhook accessible from this whereever this container will live, or even any other webhook that supports a `POST` call.
Step on how to create an automation based on a webhook call can be found pretty easily online.

I prefer docker, but you can use the script however you wish (you can even spin-up a dedicated Windows machine for-it :D

You could also run-it anywhere as-long as it has access to your Hass instance.

## Installation
### 1. Using `docker-compose`
If you are using `docker-compose` for your homelab stack, then you can have-it autobuild by following this example
#### 1. Clone the repo
```bash
git clone https://github.com/nimda95/hass-tuya-doorbell-notification.git
```
#### 2. Change the `docker-compose.yml` to your needs
```yaml
  doorbell_notify:
    container_name: doorbell_notify
    hostname: doorbell_notify
    build:
      context: . # path of the 
    restart: unless-stopped
    environment:
      - TUYA_CLIENT_ID=xxxxxxxxxxxxxxxx # Get-it from the Tuya dashboard
      - TUYA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxx # Get-it from the Tuya dashboard
      - TUYA_REGION=XX # You can choose from the following CN, US, EU, IN
      - DOORBELL_DEVICE_ID=xxxxxxxxxxxxxxxxxxxxxx # Doorbell video ID (you can get-it from the app)
      - HASS_WEBHOOK_URL=http://homeassistant.local:8123/api/webhook/doorbell-ring-xxxxxxxxxxxxxxxxxxxx # Hass Webhook URL
      - DEBUG=true # if you wan to log the RAW pushed payloads of the doorbell ringing.
    logging:
      driver: "json-file"
      options:
        max-size: "200k"
        max-file: "10"
```
#### 3. Build
```bash
docker-compose up -d doorbell_notify
```
#### 4. Have a look at the logs for any issues
```bash
docker logs -f doorbell_notify
```
### 2. The manual way
#### 1. Build
```bash
docker build . -t doorbell_notify
```
#### 2. Run
```bash
docker run -d --name doorbell_notify \
      -e "TUYA_CLIENT_ID=xxxxxxxxxxxxxxxx" \
      -e "TUYA_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxx" \
      -e "TUYA_REGION=XX" \
      -e "DOORBELL_DEVICE_ID=xxxxxxxxxxxxxxxxxxxxxx" \
      -e "HASS_WEBHOOK_URL=http://homeassistant.local:8123/api/webhook/doorbell-ring-xxxxxxxxxxxxxxxxxxxx" \
      -e "DEBUG=true" \
      doorbell_notify
```
#### 3. Have a look at the logs for any issues
```bash
docker logs -f doorbell_notify
```
## Tip
Example automation that will:
1. Clear the playlist on my local `mpd` instance
2. Turn the USB socket powering the home speaker
3. Increase the volume to 100%
4. Using TTS, say "Sombody is at the door" over the said speaker
5. Send a notification to my phone with a picture from the doorbell camera using the onvif integration,
6. Show the doorbell stream on my Home TV (I don't care if it's already turned-on or not)
7. Save a screenshot of the callee for the media folder of Home Assistant
8. Wait for 1 minute before stopping the stream on my Home TV
```yaml
alias: Doorbell Ring
description: ""
trigger:
  - platform: webhook
    allowed_methods:
      - POST
      - GET
    local_only: false
    webhook_id: doorbell-ring-xxxxxxxxxxxxxxxxxxxx
condition: []
action:
  - service: media_player.clear_playlist
    data: {}
    target:
      entity_id: media_player.living_speaker_upnp_av_2
  - type: turn_on
    device_id: 308bfa827622b9a507155ae674c9540b
    entity_id: 9885ca15254e94de19c37d9b017c15f2
    domain: switch
  - parallel:
      - service: media_player.volume_set
        data:
          volume_level: 1
        target:
          device_id: d386fd7188cc2a4d8e7e0eab4a650661
      - service: media_player.play_media
        target:
          entity_id: media_player.living_speaker
        data:
          media_content_id: >-
            media-source://tts/google_translate?message=Sombody+is+at+the+door+%21&language=en
          media_content_type: provider
        metadata:
          title: Sombody is at the door !
          thumbnail: https://brands.home-assistant.io/_/google_translate/logo.png
          target:
            entity_id: device_tracker.zfold4
          media_class: app
          children_media_class: null
          navigateIds:
            - {}
            - media_content_type: app
              media_content_id: media-source://tts
            - media_content_type: provider
              media_content_id: >-
                media-source://tts/google_translate?message=Sombody+is+at+the+door+%21&language=en
      - service: notify.mobile_app_zfold4
        data:
          message: Somebody is at the door
          title: Home Doorbell
          data:
            image: /api/camera_proxy/camera.doorbell_substream
            ttl: 0
            priority: high
      - service: media_player.play_media
        target:
          entity_id: media_player.mi_box
        data:
          media_content_id: media-source://camera/camera.doorbell_substream
          media_content_type: application/vnd.apple.mpegurl
        metadata:
          title: Doorbell SubStream
          thumbnail: /api/camera_proxy/camera.doorbell_substream
          media_class: video
          children_media_class: null
          navigateIds:
            - {}
            - media_content_type: app
              media_content_id: media-source://camera
      - service: camera.snapshot
        data:
          entity_id: camera.doorbell_substream
          filename: >-
            /media/snapshots/doorbell/ring_{{ now().strftime("%Y-%m-%d
            %H.%M.%S") }}_doorbell.jpg
      - service: camera.record
        data:
          duration: 30
          lookback: 0
          filename: >-
            /media/snapshots/doorbell/ring_{{ now().strftime("%Y-%m-%d
            %H.%M.%S") }}_doorbell.mp4
        target:
          entity_id: camera.doorbell_substream
  - delay:
      hours: 0
      minutes: 1
      seconds: 0
      milliseconds: 0
  - service: media_player.media_stop
    data: {}
    target:
      device_id:
        - ffae025a9a5469580559cc9f28263e1b
        - edc9078d00e191751d26626a7651b449


```
## Contribute
Please, be my guest :D