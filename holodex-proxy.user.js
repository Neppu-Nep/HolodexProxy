// ==UserScript==
// @name         Custom Holodex Proxy
// @version      0.6
// @description  Proxy for Holodex to add user-specified channels from youtube and twitch
// @author       Nep
// @connect      twitch.tv
// @match        https://holodex.net/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=holodex.net
// @grant        GM_xmlhttpRequest
// @updateURL    https://raw.githubusercontent.com/Neppu-Nep/HolodexProxy/refs/heads/main/holodex-proxy.user.js
// @downloadURL  https://raw.githubusercontent.com/Neppu-Nep/HolodexProxy/refs/heads/main/holodex-proxy.user.js
// @run-at       document-start
// ==/UserScript==

(async function() {

    const DELAY_BETWEEN_UPDATES = 10 * 60 * 1000; // 10~15 minute should be okay, Don't set it too low or your quota will be used up quickly
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
        "RyeIsBread": {
            "twitter": "BreadIsRye",
            "thumbnail": "https://static-cdn.jtvnw.net/jtv_user_pictures/cdb72e42-46a4-41f9-90e1-82020050c992-profile_image-70x70.png",
            "twitch": "ryeisbread",
            "youtube": "UC-SZ5Y0AHjdsF0DJPNH-hRQ"
        }
    };

    async function initDetails() {
        const version = 0.6;
        let config = null;
        if (localStorage.getItem("HolodexProxyDetails")) {
            config = JSON.parse(localStorage.getItem("HolodexProxyDetails"));
        }

        HolodexProxyVideoTemp = [];

        if (!config) {
            config = {streamsData: [], channelsData: {}, lastStreamDataUpdate: 0, lastChannelDataUpdate: 0, version: version};
        }
        else if (!Object.keys(config).includes("version") || config.version < version) {
            config.version = version;
        }
        localStorage.setItem("HolodexProxyDetails", JSON.stringify(config));
    }

    await initDetails();
    unsafeWindow.HolodexProxyDetails = JSON.parse(localStorage.getItem("HolodexProxyDetails"));
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
                            const channelData = unsafeWindow.HolodexProxyDetails.channelsData[ChannelInfos[key].youtube].channelData;
                            favData.push({
                                id: channelData.id,
                                name: channelData.name,
                                english_name: channelData.english_name,
                                photo: channelData.photo,
                                type: channelData.type,
                                subscriber_count: channelData.subscriber_count,
                                video_count: channelData.video_count,
                                clip_count: channelData.clip_count,
                                twitter: channelData.twitter,
                                org: channelData.org,
                                inactive: channelData.inactive,
                                group: channelData.group
                            })
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
                            const offset = parseInt(parsedUrl.searchParams.get("offset"));
                            const limit = parseInt(parsedUrl.searchParams.get("limit"));
                            const end = offset + limit;
                            const videos = unsafeWindow.HolodexProxyDetails.channelsData[customRequestToChannelId].videos.slice(offset, end);
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

    async function fetchYtVideosData(videoIds, api_key, mode = "stream") {

        if (api_key === "") {
            console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube data fetch.");
            return [];
        }

        let finalResponse = [];
        for (let i = 0; i < videoIds.length; i += 50) {

            const chunk = videoIds.slice(i, i + 50);
            const videoUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,contentDetails&id=${chunk.join(",")}&key=${api_key}`;
            const videoResponse = await fetch(videoUrl);
            const videoData = await videoResponse.json();

            for (const item of videoData.items) {
                const isLive = item.snippet.liveBroadcastContent;

                if (mode === "stream" && !item.liveStreamingDetails.scheduledStartTime) {
                    continue;
                }

                let result = {
                    id: item.id,
                    title: item.snippet.title,
                    type: "stream",
                    published_at: item.snippet.publishedAt,
                    available_at: mode === "stream" ? item.liveStreamingDetails.scheduledStartTime : item.snippet.publishedAt,
                    duration: 0,
                    status: isLive === "none" ? "past" : isLive,
                    start_scheduled: mode === "stream" ? item.liveStreamingDetails.scheduledStartTime : item.snippet.publishedAt,
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
                else if (isLive === "none" && mode === "stream") {
                    result.start_actual = item.liveStreamingDetails ? item.liveStreamingDetails.actualStartTime : item.snippet.publishedAt;
                    result.end_actual = item.liveStreamingDetails
                    result.duration = (new Date(item.liveStreamingDetails.actualEndTime) - new Date(item.liveStreamingDetails.actualStartTime)) / 1000;
                    result.clips = [];
                }
                else if (isLive === "none") {
                    const durationString = item.contentDetails.duration.substring(2);
                    const duration = durationString.match(/(\d+H)?(\d+M)?(\d+S)?/);
                    const hours = (parseInt(duration[1]) || 0);
                    const minutes = (parseInt(duration[2]) || 0);
                    const seconds = (parseInt(duration[3]) || 0);
                    result.duration = hours * 3600 + minutes * 60 + seconds;
                    result.clips = [];
                }
                finalResponse.push(result);
            }
        }

        return finalResponse;

    }

    async function checkYt(channelIds, api_key, limit = true, count = 7, mode = "stream") {

        if (api_key === "") {
            console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube data fetch.");
            return [];
        }

        let videoIds = [];
        const modes = {
            "videos": "UULF",
            "stream": "UULV",
            "membersonly": "UUMO",
            "membersonlylive": "UUMV",
            "shorts": "UUSH",
        }

        await Promise.all(channelIds.map(async (channelId) => {
            console.log(`[Holodex Proxy] Fetching youtube data for ${channelId} (${mode}) with count ${count}`);
            const playlistId = `${modes[mode]}${channelId.substring(2)}`;
            let nextPageToken = null;

            try {
                while (true) {
                    const playlistUrl = `https://youtube.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=${count}&playlistId=${playlistId}&key=${api_key}${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
                    const response = await fetch(playlistUrl);
                    const data = await response.json();

                    for (const item of data.items) {
                        videoIds.push(item.snippet.resourceId.videoId);
                    }

                    if (!data.nextPageToken || limit) {
                        break;
                    }
                    nextPageToken = data.nextPageToken;
                }
            } catch (err) {}
        }));

        let finalResponse = [];
        if (videoIds.length == 0) {
            return finalResponse;
        }

        finalResponse = await fetchYtVideosData(videoIds, api_key, mode);
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
                let parsedData = JSON.parse(firstPart.substring(0, firstPart.indexOf("</script>")))["@graph"][0];

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

        const currentTimestamp = Date.now();
        if (currentTimestamp - unsafeWindow.HolodexProxyDetails.lastStreamDataUpdate > DELAY_BETWEEN_UPDATES) {
            console.log("[Holodex Proxy] Updating upcoming livestream data");
            const ytChannels = Object.keys(ChannelInfos).filter(key => Object.keys(ChannelInfos[key]).includes("youtube")).map(key => ChannelInfos[key].youtube);
            const twitchChannels = Object.keys(ChannelInfos).filter(key => Object.keys(ChannelInfos[key]).includes("twitch")).map(key => [ChannelInfos[key].twitch, key]);

            let ytData = await checkYt(ytChannels, YOUTUBE_API_KEY);
            let ytMembersData = await checkYt(ytChannels, YOUTUBE_API_KEY, false, 7, "membersonlylive");
            let twitchData = await checkTwitch(twitchChannels);

            let finalData = ytData.concat(twitchData).concat(ytMembersData).filter(video => video.duration == 0);

            unsafeWindow.HolodexProxyDetails.streamsData = finalData;
            unsafeWindow.HolodexProxyDetails.lastStreamDataUpdate = currentTimestamp;
            localStorage.setItem("HolodexProxyDetails", JSON.stringify(unsafeWindow.HolodexProxyDetails));
        }
        else {
            console.log(`[Holodex Proxy] Upcoming livestream data is up to date. Next update in ${(DELAY_BETWEEN_UPDATES - (currentTimestamp - unsafeWindow.HolodexProxyDetails.lastStreamDataUpdate)) / 1000} seconds`)
        }

        // Clean up unused channels
        const indexingChannels = Object.keys(ChannelInfos).filter(key => Object.keys(ChannelInfos[key]).includes("youtube")).map(key => ChannelInfos[key].youtube);
        for (let key in unsafeWindow.HolodexProxyDetails.channelsData) {
            if (!indexingChannels.includes(key)) {
                delete unsafeWindow.HolodexProxyDetails.channelsData[key];
            }
        }

        if (currentTimestamp - unsafeWindow.HolodexProxyDetails.lastChannelDataUpdate > 1000 * 60 * 60) { // Check every 1 hour
            console.log("[Holodex Proxy] Refreshing Extra details data");

            for (let key in ChannelInfos) {

                let youtubeKey = ChannelInfos[key].youtube;
                if (!youtubeKey) {
                    continue;
                }

                console.log(`[Holodex Proxy] Fetching youtube extra data for ${key} (${youtubeKey})`);
                if (!(youtubeKey in unsafeWindow.HolodexProxyDetails.channelsData)) {
                    unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey] = {
                        channelData: {},
                        videos: []
                    }
                }

                let currentChannel = unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey];
                if ("updated_at" in currentChannel.channelData) {
                    const lastUpdate = new Date(currentChannel.channelData.updated_at);
                    if (currentTimestamp - lastUpdate < 1000 * 60 * 60 * 24) { // Only update every 1 day
                        continue;
                    }
                }
                currentChannel.channelData.updated_at = new Date().toISOString();

                const liveOrUpcomingVids = unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos.filter(video => video.status === "live" || video.status === "upcoming");
                if (liveOrUpcomingVids.length > 0) {
                    let liveOrUpcomingVidsIds = liveOrUpcomingVids.map(video => video.id);
                    const liveOrUpcomingVidsData = await fetchYtVideosData(liveOrUpcomingVidsIds, YOUTUBE_API_KEY, "stream");

                    for (let video of liveOrUpcomingVidsData) {
                        console.log(`[Holodex Proxy] Updating ${video.id} from ${video.channel.id} (${video.channel.name})`);
                        const index = unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos.findIndex(v => v.id === video.id);
                        if (index !== -1) {
                            unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos[index] = video;
                        }
                        else {
                            unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos.push(video);
                        }
                        liveOrUpcomingVidsIds = liveOrUpcomingVidsIds.filter(id => id !== video.id);
                    }

                    for (let id of liveOrUpcomingVidsIds) {
                        console.log(`[Holodex Proxy] ${id} is no longer available. Removing from cache.`);
                        unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos = unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos.filter(video => video.id !== id);
                    }

                    unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos = unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
                }

                if ("recrawled_at" in currentChannel.channelData) {
                    const lastRecrawl = new Date(currentChannel.channelData.recrawled_at);
                    if (currentTimestamp - lastRecrawl < 1000 * 60 * 60 * 24 * 7) { // Only recrawl all videos every week
                        continue;
                    }
                }

                console.log(`[Holodex Proxy] Data for ${key} (${youtubeKey}) is probably outdated. Fetching new data.`);
                if (YOUTUBE_API_KEY === "") {
                    console.error("[Holodex Proxy] Youtube API key is not set. Skipping youtube data fetch.");
                }
                else {
                    let response = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,id,snippet,statistics,brandingSettings&id=${youtubeKey}&key=${YOUTUBE_API_KEY}`);
                    let data = await response.json();
                    let currentChannelNewData = {
                        id: youtubeKey,
                        name: data.items[0].snippet.title,
                        english_name: data.items[0].snippet.title,
                        description: data.items[0].snippet.description,
                        photo: data.items[0].snippet.thumbnails.default.url,
                        thumbnail: null,
                        banner: data.items[0].brandingSettings.image ? data.items[0].brandingSettings.image.bannerExternalUrl : "",
                        org: "Independents",
                        suborg: "",
                        lang: null,
                        published_at: data.items[0].snippet.publishedAt,
                        view_count: data.items[0].statistics.viewCount,
                        video_count: data.items[0].statistics.videoCount,
                        subscriber_count: data.items[0].statistics.subscriberCount,
                        comments_crawled_at: "",
                        updated_at: new Date().toISOString(),
                        recrawled_at: new Date().toISOString(),
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

                    unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].channelData = currentChannelNewData;

                    const modes = {
                        "videos": "UULF",
                        "stream": "UULV",
                        "membersonly": "UUMO",
                        "shorts": "UUSH",
                    }
                    for (const mode in modes) {
                        const videoData = await checkYt([youtubeKey], YOUTUBE_API_KEY, false, currentChannelNewData.video_count, mode);
                        unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos = videoData.concat(unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos);
                        unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos = unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos.filter((video, index, self) => self.findIndex(v => v.id === video.id) === index);
                        await new Promise(r => setTimeout(r, 5000));
                    }
                }
                unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos = unsafeWindow.HolodexProxyDetails.channelsData[youtubeKey].videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));

                break; // Only update one channel at a time
            }
            unsafeWindow.HolodexProxyDetails.lastChannelDataUpdate = currentTimestamp;
            localStorage.setItem("HolodexProxyDetails", JSON.stringify(unsafeWindow.HolodexProxyDetails));
        }

        for (let video of unsafeWindow.HolodexProxyDetails.streamsData) {
            if (!video.channel.id.startsWith("UC")) continue;
            console.log(`[Holodex Proxy] Updating video data for ${video.id} from ${video.channel.id} (${video.channel.name})`);
            const index = unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos.findIndex(v => v.id === video.id);
            if (index !== -1) {
                unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos[index] = video;
            }
            else {
                unsafeWindow.HolodexProxyDetails.channelsData[video.channel.id].videos.push(video);
            }
        }

        unsafeWindow.HolodexProxyVideoTemp = [];
        for (let key in unsafeWindow.HolodexProxyDetails.channelsData) {
            unsafeWindow.HolodexProxyDetails.channelsData[key].videos = unsafeWindow.HolodexProxyDetails.channelsData[key].videos.sort((a, b) => new Date(b.available_at) - new Date(a.available_at));
            unsafeWindow.HolodexProxyVideoTemp = unsafeWindow.HolodexProxyVideoTemp.concat(unsafeWindow.HolodexProxyDetails.channelsData[key].videos);
        }
        localStorage.setItem("HolodexProxyDetails", JSON.stringify(unsafeWindow.HolodexProxyDetails));
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
    }).observe(document.documentElement, { childList: true, subtree: true });

    await updateData();
    unsafeWindow.updateData = updateData;

})();