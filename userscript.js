// ==UserScript==
// @name         Custom Holodex Proxy
// @version      0.3
// @description  Proxy for Holodex to add user-specified channels from youtube and twitch
// @author       Nep
// @connect      twitch.tv
// @match        https://holodex.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=holodex.net
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(async function() {

    const DELAY_BETWEEN_UPDATES = 5 * 60 * 1000; // 5 minute, Don't set it too low or your quota will be used up quickly
    const YOUTUBE_API_KEY = ""; // Add your youtube API key here (Careful with this, don't share your API key)
    const ChannelInfos = {
        "BriAtCookiebox": {
            "thumbnail": "https://yt3.googleusercontent.com/ytc/AIf8zZQiDJ8ifPuPnoodU02w9BOEoVp1oDWI26ElSLY0=s176-c-k-c0x00ffffff-no-rj",
            "youtube": "UC1uzMZ7x_Hgun5t8J9uFanw"
        },
        "HexaVT": {
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/28bf2400-367f-4fc9-a1b4-cb178d651ad5-profile_image-70x70.png",
            "twitch": "hexa",
            "youtube": "UCylRywfGAHCiW4PQvr1h_3w"
        },
        "Nanobites": {
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/491954e0-2aab-40ed-b3d9-f9930609d327-profile_image-70x70.png",
            "twitch": "nanobites",
            "youtube": "UCdqDlrY_4p3z_Ho4hS2-4Zw"
        },
        "UWO's Lab": {
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/ba4a5f71-f6f9-4aba-8572-605dbd551f34-profile_image-70x70.png",
            "twitch": "uwoslab"
        },
        "Grimmi": {
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/1998f1d0-692f-461b-ab5b-ac276c069e48-profile_image-70x70.png",
            "twitch": "grimmivt"
        }
    };

    unsafeWindow.extraData = [];

    let oldXHROpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (url.toString().includes("/api/v2/users/live")) {
            this.addEventListener("readystatechange", function() {
                if (this.readyState === 4) {
                    let oldResponse = JSON.parse(this.responseText);
                    Object.defineProperty(this, 'response', {writable: true});
                    Object.defineProperty(this, 'responseText', {writable: true});

                    let newResponse = oldResponse.concat(unsafeWindow.extraData);
                    this.response = this.responseText = JSON.stringify(newResponse);
                }
            });
        }

        return oldXHROpen.apply(this, arguments);
    };

    async function checkYt(channelIds, YOUTUBE_API_KEY) {

        if (YOUTUBE_API_KEY === "") {
            console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube data fetch.");
            return [];
        }

        let videoIds = [];

        await Promise.all(channelIds.map(async (channelId) => {
            console.log(`[Holodex Proxy] Fetching youtube data for ${channelId}`);
            const playlistId = "UULV" + channelId.substring(2);
            const playlistUrl = `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=7&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}`;
            const response = await fetch(playlistUrl);
            const data = await response.json();

            for (const item of data.items) {
                videoIds.push(item.snippet.resourceId.videoId);
            }
        }));

        let finalResponse = [];
        if (videoIds.length == 0) {
            return finalResponse;
        }

        for (let i = 0; i < videoIds.length; i += 50) {

            const chunk = videoIds.slice(i, i + 50);
            const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${chunk.join(",")}&key=${YOUTUBE_API_KEY}`;
            const videoResponse = await fetch(videoUrl);
            const videoData = await videoResponse.json();
    
            for (const item of videoData.items) {
                const isLive = item.snippet.liveBroadcastContent;
                let result = {
                    id: item.id,
                    title: item.snippet.title,
                    type: "stream",
                    published_at: item.snippet.publishedAt,
                    available_at: item.liveStreamingDetails.scheduledStartTime,
                    duration: 0,
                    status: isLive === "live" ? "live" : "upcoming",
                    start_scheduled: item.liveStreamingDetails.scheduledStartTime,
                    live_viewers: isLive === "live" ? item.liveStreamingDetails.concurrentViewers : 0,
                    channel: {
                        id: item.snippet.channelId,
                        name: item.snippet.channelTitle,
                        org: "Independents",
                        suborg: "",
                        type: "vtuber",
                        photo: "",
                        english_name: item.snippet.channelTitle,
                    }
                };

                if (isLive === "live") {
                    result.start_actual = item.liveStreamingDetails.actualStartTime;
                }
                finalResponse.push(result);
            }
        }

        return finalResponse;
    }

    async function GM_fetch(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                onload: (response) => {
                    resolve(response.responseText);
                },
                onerror: (error) => {
                    reject(error);
                }
            });
        });
    }

    function generateRandomString(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({length}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    async function checkTwitch(channelIds) {
        let finalResponse = [];
        await Promise.all(channelIds.map(async ([channelId, channelName]) => {
            console.log(`[Holodex Proxy] Fetching twitch data for ${channelId}`);
            const data = await GM_fetch(`https://twitch.tv/${channelId}`);

            let thumb_url = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelId}-1920x1080.jpg`;

            if (data.includes("isLiveBroadcast")) {

                const thumb_data = await fetch(thumb_url);
                if (thumb_data.redirected) {
                    return;
                }

                let firstPart = data.substring(data.indexOf('<script type="application/ld+json">') + 35);
                let parsedData = JSON.parse(firstPart.substring(0, firstPart.indexOf("</script>")))[0];
                finalResponse.push({
                    id: `proxy${generateRandomString(6)}`,
                    title: parsedData.description,
                    type: "placeholder",
                    available_at: parsedData.publication.startDate,
                    duration: 0,
                    status: "live",
                    start_scheduled: parsedData.publication.startDate,
                    start_actual: parsedData.publication.startDate,
                    channel: {
                        id: channelId,
                        name: channelName,
                        org: "Independents",
                        suborg: "",
                        type: "vtuber",
                        photo: "",
                        english_name: channelName,
                    },
                    link: `https://twitch.tv/${channelId}`,
                    certainty: "certain",
                    thumbnail: thumb_url,
                    placeholderType: "external-stream",
                });
            }
        }));
        return finalResponse;
    }

    async function updateData() {
        const ytChannels = Object.keys(ChannelInfos).filter(key => Object.keys(ChannelInfos[key]).includes("youtube")).map(key => ChannelInfos[key].youtube);
        const twitchChannels = Object.keys(ChannelInfos).filter(key => Object.keys(ChannelInfos[key]).includes("twitch")).map(key => [ChannelInfos[key].twitch, key]);

        let ytData = await checkYt(ytChannels, YOUTUBE_API_KEY);
        let twitchData = await checkTwitch(twitchChannels);

        unsafeWindow.extraData = ytData.concat(twitchData);
        setTimeout(updateData, DELAY_BETWEEN_UPDATES);
    }

    function transform(img) {
        const imgSrc = img.src.split("/statics/channelImg/");
        if (imgSrc.length < 2) {
            return;
        }

        const mode = imgSrc[1].startsWith("UC") ? "youtube" : "twitch";

        for (let key in ChannelInfos) {
            if (img.src.includes(ChannelInfos[key][mode])) {
                img.src = ChannelInfos[key].thumbnail;
                break;
            }
        }
    }

    new MutationObserver((mutations) => {
        for (const { addedNodes } of mutations) {
            for (const addedNode of addedNodes) {
                if (addedNode.nodeType !== 1) continue;
                const imgs = addedNode.querySelectorAll('img');
                for (const img of imgs) {
                    transform(img);
                }
                if (addedNode.tagName === 'IMG') {
                    transform(addedNode);
                }
            }
        }
    }).observe(document.body, { childList: true, subtree: true });

    await updateData();

})();