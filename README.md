# Holodex Proxy

### This project isn't affiliated with Holodex. Please open an issue here or join the support discord below if you have any problems with the project.

This is a project that allows you to add any YouTube or Twitch channel that aren't on Holodex to Holodex favorite list for live and upcoming streams. 

This project **does not** add the channels to Holodex's database. It only adds the channel to your personal Holodex favorite list on your browser. This means that the channel will only show up on your browser and not on other devices or browsers.

Support Discord: [link](https://discord.gg/cm4kyTsrPS)

## Requirements
- YouTube Data API v3 key - [link](https://console.developers.google.com/)
- Tampermoney - [link](https://www.tampermonkey.net/)
- Violentmonkey - [link](https://violentmonkey.github.io/get-it/)

### YouTube Data API v3
1. Go to the [Google Cloud Console](https://console.developers.google.com/).
2. Create a new project.
3. Go to the "APIs & Services" > "Library" and enable the "YouTube Data API v3".
4. Go to the "APIs & Services" > "Credentials" and create a new API key.
5. Copy the API key and save it for later.

### Tampermonkey/Violentmonkey
1. Install the Tampermonkey/Violentmonkey extension for your browser.
2. Click on `holodex-proxy.user.js` in the root of this repository.
3. Then click on "Raw" to install the script.

## Usage
1. Go to the [Holodex](https://holodex.net/).
2. Click on your extension icon and click on the "Holodex Proxy Settings" button.
3. Paste the YouTube Data API v3 key you created earlier into the input box.
4. You can add new channels by clicking on the "Add Channel" button.
    - Display name: The name of the channel that will be displayed on Holodex.
    - Twitter: The Twitter username of the channel. This is optional and is just for linking on the channel page.
    - Thumbnail: The thumbnail link of the channel. You can use the channel's profile picture link or leave it empty for the default icon.
    - YouTube Channel ID: The channel ID of the YouTube channel. You can get it by going to the channel, "About", Scroll down, "Share Channel", and "Copy Channel ID".
    - Twitch Channel ID: The channel ID of the Twitch channel. It's the last part of the URL. Example: `https://www.twitch.tv/`**channel_id**.
    - Click on "Save Channel Change" to save the channel.
5. Click on the "Save & Apply Settings" button to save the settings.
6. Refresh the Holodex page to see the changes.
