# Holodex Proxy

### This project isn't affiliated with Holodex. Please open an issue here or join the support discord below if you have any problems with the project.

This is a project that allows you to add any YouTube or Twitch channel that aren't on Holodex to Holodex favorite list for live and upcoming streams. 

This project **does not** add the channels to Holodex's database. It only adds the channel to your personal Holodex favorite list on your browser. This means that the channel will only show up on your browser and not on other devices or browsers.

Support Discord: [link](https://discord.gg/cm4kyTsrPS)

## Requirements
- YouTube Data API v3 key - [link](https://console.developers.google.com/)
- Tampermoney - [link](https://www.tampermonkey.net/)

### YouTube Data API v3
1. Go to the [Google Cloud Console](https://console.developers.google.com/).
2. Create a new project.
3. Go to the "APIs & Services" > "Library" and enable the "YouTube Data API v3".
4. Go to the "APIs & Services" > "Credentials" and create a new API key.
5. Copy the API key and save it for later.

### Tampermonkey
1. Install the Tampermonkey extension for your browser.
2. Go to the dashboard and click on the "Create a new script" button.
3. Copy the code from `userscript.js` into the editor.
4. Change the `YOUTUBE_API_KEY` variable to the API key you got from the YouTube Data API v3.
5. Save the script.

## Usage
1. Get the channel ID of the channel you want to add.
    - For YouTube, you can get it by going to the channel, "About", Scroll down, "Share Channel", and "Copy Channel ID".
    - For Twitch, it's the last part of the URL. Example: `https://www.twitch.tv/`**channel_id**.
2. Grab an icon thumbnail link for the channel. Usually, you can just use the image of the channel's profile picture for both YouTube and Twitch.
3. Go to Tampermonkey, Dashboard, and edit the script you created earlier. (Should be named "Custom Holodex Proxy")
4. Add a new entry in `ChannelInfos` with the name of your choice, and the channel's thumbnail link, YouTube channel ID, and/or Twitch channel ID.

Example: 
```
{
    "channel_name": {
        "twitter": "twitter_username", // Optional (Just for linking on channel page)
        "thumbnail": "thumbnail_link",
        "youtube": "yt_channel_id",
        "twitch": "twitch_channel_id"
    }
}
```
5. Save user script and refresh the holodex page. The channel should now show up in the live and upcoming streams list if it exists.

Note: You can input empty string for thumbnail link if you are okay with the default icons.
