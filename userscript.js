// ==UserScript==
// @name         Custom Holodex Proxy
// @version      0.4
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
        "MomAtCookiebox": {
            "twitter": "MomatCookieBox",
            "thumbnail": "https://yt3.googleusercontent.com/suWyZeS-EYVFQpzGL2VvJVh7ag9fbOZjzhtySBXQ72KZibmvy2gz1RimoxYuWQaUUwmKKgTGjw=s160-c-k-c0x00ffffff-no-rj",
            "youtube": "UCcPc-5OrLbjVBgQ-ziEWPSQ"
        },
        "HexaVT": {
            "twitter": "HexaVT",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/28bf2400-367f-4fc9-a1b4-cb178d651ad5-profile_image-70x70.png",
            "twitch": "hexa",
            "youtube": "UCylRywfGAHCiW4PQvr1h_3w"
        },
        "Nanobites": {
            "twitter": "NANOBITES_",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/491954e0-2aab-40ed-b3d9-f9930609d327-profile_image-70x70.png",
            "twitch": "nanobites",
            "youtube": "UCdqDlrY_4p3z_Ho4hS2-4Zw"
        },
        "UWO's Lab": {
            "twitter": "uwutoowo1",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/ba4a5f71-f6f9-4aba-8572-605dbd551f34-profile_image-70x70.png",
            "twitch": "uwoslab"
        },
        "Grimmi": {
            "twitter": "GrimmiVT",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/1998f1d0-692f-461b-ab5b-ac276c069e48-profile_image-70x70.png",
            "twitch": "grimmivt",
            "youtube": "UChpppq5ezHdxvIFjp6nbS7A"
        }
    };

    unsafeWindow.HolodexProxyDetails = localStorage.getItem("HolodexProxyDetails") ? JSON.parse(localStorage.getItem("HolodexProxyDetails")) : {streamsData: [], channelsData: {}, lastUpdate: 0};
    let oldXHROpen = window.XMLHttpRequest.prototype.open;

    window.XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        
        let customRequestToChannelId = null;
        let customRequestToVideoId = null;
        let parsedUrl = new URL(url);

        if (parsedUrl.pathname.includes("/api/v2/channels")) {
            let channelId = parsedUrl.pathname.split("/").pop();
            if (["videos", "clips", "collabs"].includes(channelId)) channelId = parsedUrl.pathname.split("/")[(parsedUrl.pathname.split("/").length - 2)];

            if (channelId in unsafeWindow.HolodexProxyDetails.channelsData) {
                console.log(`[Holodex Proxy] Intercepted request to Custom Channel ID: ${channelId}`);
                url = url.toString().replace(channelId, "UCp6993wxpyDPHUpavwDFqgg"); // Tokino Sora Channel ID (Prevent 404 error)
                customRequestToChannelId = channelId;
            }
        }
        else if (parsedUrl.pathname.includes("/api/v2/videos")) {
            let videoId = parsedUrl.pathname.split("/").pop();
            if (["mentions", "topic"].includes(videoId)) videoId = parsedUrl.pathname.split("/")[(parsedUrl.pathname.split("/").length - 2)];

            let videoData = unsafeWindow.HolodexProxyVideoTemp.find(video => video.id === videoId);
            if (videoData) {
                console.log(`[Holodex Proxy] Intercepted request to Custom Video ID: ${videoId}`);
                url = url.toString().replace(videoId, "ZXF1SzAtFj8"); // Tokino Sora First Video ID (Prevent 404 error)
                customRequestToVideoId = videoId;
            }
        }

        parsedUrl = new URL(url); // Re-parse the url after changing it

        this.addEventListener("readystatechange", function() {
            if (this.readyState === 4) {

                let newResponse;
                let oldResponse = JSON.parse(this.responseText);
                Object.defineProperty(this, 'response', {writable: true});
                Object.defineProperty(this, 'responseText', {writable: true});

                if (parsedUrl.pathname.includes("/api/v2/users/live")) {
                    newResponse = oldResponse.concat(unsafeWindow.HolodexProxyDetails.streamsData);
                }
                else if (parsedUrl.pathname.includes("/api/v2/users/favorites")) {
                    let favData = [];
                    for (let key in ChannelInfos) {
                        if (ChannelInfos[key].youtube in unsafeWindow.HolodexProxyDetails.channelsData) {
                            favData.push(unsafeWindow.HolodexProxyDetails.channelsData[ChannelInfos[key].youtube].channelData);
                            continue;
                        }
                    }
                    newResponse = oldResponse.concat(favData);
                }
                else if (parsedUrl.pathname.includes("/api/v2/users/videos")) {
                    let earliestDate = new Date();

                    for (let video of oldResponse.items) {
                        let videoDate = new Date(video.available_at);
                        if (videoDate < earliestDate) {
                            earliestDate = videoDate;
                        }
                    }

                    let latestDate = earliestDate;
                    for (let video of oldResponse.items) {
                        let videoDate = new Date(video.available_at);
                        if (videoDate > latestDate) {
                            latestDate = videoDate;
                        }
                    }

                    let newVideos = unsafeWindow.HolodexProxyVideoTemp.filter(video => new Date(video.available_at) < latestDate && new Date(video.available_at) >= earliestDate && video.status === "past");
                    let allVideos = oldResponse.items.concat(newVideos);
                    let sortedVideos = allVideos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
                    newResponse = {
                        "items": sortedVideos,
                        "total": sortedVideos.length
                    }
                }
                else if (customRequestToChannelId !== null || customRequestToVideoId !== null) {
                    Object.defineProperty(this, 'status', {get: () => 200});

                    if (parsedUrl.pathname.includes("/api/v2/channels")) {
                        if (parsedUrl.search == "") {
                            newResponse = unsafeWindow.HolodexProxyDetails.channelsData[customRequestToChannelId].channelData;
                        }
                        else if (parsedUrl.pathname.endsWith("/videos")) {
                            const offset = parsedUrl.searchParams.get("offset");
                            const limit = parsedUrl.searchParams.get("limit");
                            const videos = unsafeWindow.HolodexProxyDetails.channelsData[customRequestToChannelId].videos.slice(offset, offset + limit);
                            newResponse = {
                                "items": videos,
                                "total": unsafeWindow.HolodexProxyDetails.channelsData[customRequestToChannelId].videos.length
                            }
                        }
                        else {
                            newResponse = {
                                "items": [],
                                "total": 0,
                            }
                        }
                    }
                    else if (parsedUrl.pathname.includes("/api/v2/videos")) {
                        if (parsedUrl.pathname.endsWith("/mentions")) {
                            newResponse = [];
                        }
                        else if (parsedUrl.pathname.endsWith("/topic")) {
                            newResponse = {
                                "topic_id": null, 
                                "topic_approver_id":null
                            }
                        }
                        else {
                            newResponse = unsafeWindow.HolodexProxyVideoTemp.find(video => video.id === customRequestToVideoId);
                        }
                    }
                }

                this.response = this.responseText = JSON.stringify(newResponse || oldResponse);
            }
        });

        return oldXHROpen.apply(this, arguments);
    };

    async function checkYt(channelIds, YOUTUBE_API_KEY, liveOnly = true, count = 7) {

        if (YOUTUBE_API_KEY === "") {
            console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube data fetch.");
            return [];
        }

        let videoIds = [];

        await Promise.all(channelIds.map(async (channelId) => {
            console.log(`[Holodex Proxy] Fetching youtube data for ${channelId}`);
            const playlistId = "UULV" + channelId.substring(2);
            const playlistUrl = `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${count}&playlistId=${playlistId}&key=${YOUTUBE_API_KEY}`;
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

                if (isLive === "none" && liveOnly) {
                    continue;
                }

                let result = {
                    id: item.id,
                    title: item.snippet.title,
                    type: "stream",
                    published_at: item.snippet.publishedAt,
                    available_at: item.liveStreamingDetails.scheduledStartTime,
                    duration: 0,
                    status: isLive === "none" ? "past" : isLive,
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
                else if (isLive === "none") {
                    result.start_actual = item.liveStreamingDetails.actualStartTime;
                    result.end_actual = item.liveStreamingDetails.actualEndTime;
                    result.duration = (new Date(item.liveStreamingDetails.actualEndTime) - new Date(item.liveStreamingDetails.actualStartTime)) / 1000;
                    result.clips = [];
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
        console.log("[Holodex Proxy] Updating stream data");
        const ytChannels = Object.keys(ChannelInfos).filter(key => Object.keys(ChannelInfos[key]).includes("youtube")).map(key => ChannelInfos[key].youtube);
        const twitchChannels = Object.keys(ChannelInfos).filter(key => Object.keys(ChannelInfos[key]).includes("twitch")).map(key => [ChannelInfos[key].twitch, key]);

        let ytData = await checkYt(ytChannels, YOUTUBE_API_KEY);
        let twitchData = await checkTwitch(twitchChannels);

        unsafeWindow.HolodexProxyDetails.streamsData = ytData.concat(twitchData);
        localStorage.setItem("HolodexProxyDetails", JSON.stringify(unsafeWindow.HolodexProxyDetails));

        if (Object.keys(unsafeWindow.HolodexProxyDetails.channelsData).length === 0 || Date.now() - unsafeWindow.HolodexProxyDetails.lastUpdate > 1000 * 60 * 60 * 24 * 7) { // 1 week
            console.log("[Holodex Proxy] Refreshing extra details data");
            unsafeWindow.HolodexProxyDetails.lastUpdate = Date.now();
            let channelExtraData = {};

            for (let key in ChannelInfos) {
                if (ChannelInfos[key].youtube) {
                    console.log(`[Holodex Proxy] Fetching youtube extra data for ${key} (${ChannelInfos[key].youtube})`);
                    let response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,id,snippet,statistics&id=${ChannelInfos[key].youtube}&key=${YOUTUBE_API_KEY}`);
                    let data = await response.json();
                    channelExtraData[ChannelInfos[key].youtube] = {
                        id: ChannelInfos[key].youtube,
                        name: data.items[0].snippet.title,
                        english_name: data.items[0].snippet.title,
                        description: data.items[0].snippet.description,
                        photo: data.items[0].snippet.thumbnails.default.url,
                        org: "Independents",
                        suborg: "",
                        lang: null,
                        published_at: data.items[0].snippet.publishedAt,
                        view_count: data.items[0].statistics.viewCount,
                        video_count: data.items[0].statistics.videoCount,
                        subscriber_count: data.items[0].statistics.subscriberCount,
                        comments_crawled_at: "",
                        updated_at: "",
                        yt_uploads_id: data.items[0].contentDetails.relatedPlaylists.uploads,
                        crawled_at: "",
                        type: "vtuber",
                        clip_count: 0,
                        twitter: ChannelInfos[key].twitter || "",
                        inactive: false,
                        created_at: "",
                        top_topics: [],
                        yt_handle: [data.items[0].snippet.customUrl],
                        twitch: ChannelInfos[key].twitch || null,
                        yt_name_history: [],
                        groups: ""
                    }
                }
            }

            for (let key in channelExtraData) {
                unsafeWindow.HolodexProxyDetails.channelsData[key] = {
                    channelData: channelExtraData[key],
                    videos: []
                }
                let videoData = await checkYt([key], YOUTUBE_API_KEY, false, 48);
                unsafeWindow.HolodexProxyDetails.channelsData[key].videos = videoData;
            }
            localStorage.setItem("HolodexProxyDetails", JSON.stringify(unsafeWindow.HolodexProxyDetails));
        }

        unsafeWindow.HolodexProxyVideoTemp = [];
        for (let key in unsafeWindow.HolodexProxyDetails.channelsData) {
            unsafeWindow.HolodexProxyVideoTemp = unsafeWindow.HolodexProxyVideoTemp.concat(unsafeWindow.HolodexProxyDetails.channelsData[key].videos);
        }
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
    unsafeWindow.updateData = updateData;

})();