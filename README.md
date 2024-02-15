# Holodex Proxy

### This project isn't affiliated with Holodex. Please open an issue here if you have any problems with the proxy.

## Requirements
- Cloudflare Worker account - [link](https://workers.cloudflare.com/)
- YouTube Data API v3 key - [link](https://console.developers.google.com/)
- Tampermoney - [link](https://www.tampermonkey.net/)

### YouTube Data API v3
1. Go to the [Google Cloud Console](https://console.developers.google.com/).
2. Create a new project.
3. Go to the "APIs & Services" > "Library" and enable the "YouTube Data API v3".
4. Go to the "APIs & Services" > "Credentials" and create a new API key.
5. Copy the API key and save it for later.

### Cloudflare Worker
1. Register an account on Cloudflare Workers and verify your email.
2. Go to Workers & Pages, Overview, and click "Create Worker".
3. Choose a name for your worker. This name will be used in the URL of your proxy.
4. Click on "Edit Code" and paste the code from `worker.js` into the editor.
5. Click "Save and Deploy".
6. Go to "Settings", "Variables", and add a new variable with the name `YOUTUBE_API` and the value of your YouTube Data API key from earlier.
7. Save the full URL of your worker for later. It should look something like `your_subdomain.your_username.workers.dev`.

Extra: To change subdomain, go to "Workers & Pages", Overview, and click on change subdomain.

### Tampermonkey
1. Install the Tampermonkey extension for your browser.
2. Go to the dashboard and click on the "Create a new script" button.
3. Copy the code from `userscript.js` into the editor.
4. Change the `proxyURL` variable to the URL of your Cloudflare worker.
5. Save the script.

## Usage
1. Get the channel ID of the channel you want to add.
    - For YouTube, you can get it by going to the channel, "About", Scroll down, "Share Channel", and "Copy Channel ID".
    - For Twitch, it's the last part of the URL. Example: `https://www.twitch.tv/`**channel_id**.
2. Login to your Cloudflare account and go to your created worker. Press "Quick Edit". Add the respective channel ID to either `YTChannels` or `TwitchChannels`. For Twitch, it would be a list of strings. The first string is the channel ID and the second string is the channel name. Example: `["channel_id", "channel_name"]`.
3. Save and Deploy the worker.
4. Grab an icon thumbnail link for the channel. Usually, you can just use the image address of the channel's profile picture for both YouTube and Twitch.
5. In your browser, open extension list, click on Tampermonkey, Dashboard, and go to the script you created earlier. Edit the script and add the channel ID and icon link to the `THUMBNAIL_MAP` array.
6. Save the script and refresh the page.

Note: You can skip step 4, 5, and 6 if you are okay with the default icons.
